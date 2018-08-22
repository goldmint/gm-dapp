pragma solidity ^0.4.18;

contract GoldmintPowh {

    IMNTP _mntpToken;

    uint256 constant internal MAGNITUDE = 2**64;

    uint8 constant internal TOTAL_FEE_PERCENT = 10;

    uint8 constant internal DEV_REWARD_PERCENT = 40;
    uint8 constant internal SHARE_REWARD_PERCENT = 30;
    uint8 constant internal REF_BONUS_PERCENT = 20;
    uint8 constant internal BIG_PROMO_PERCENT = 5;
    uint8 constant internal QUICK_PROMO_PERCENT = 5;


    uint256 constant internal TOKEN_PRICE_INITIAL = 0.01 ether;
    uint256 constant internal TOKEN_PRICE_INC = 0.00000001 ether;
    uint256 constant internal MIN_REF_TOKEN_AMOUNT = 1 ether;

    
    // ambassador program
    mapping(address => bool) internal _ambassadors;
    uint256 constant internal _ambassadorMaxPurchase = 1 ether;
    uint256 constant internal _ambassadorQuota = 20 ether;


    mapping(address => uint256) internal _userTokenBalances;
    mapping(address => uint256) internal _referralBalances;
    mapping(address => int256) internal _rewardPayouts;
    mapping(address => uint256) internal _ambassadorAccumulatedQuota;    

    mapping(bytes32 => bool) public _administrators;
    
    uint256 internal _bonusPerMntp;
    
    event onTokenPurchase(
        address indexed customerAddress,
        uint256 incomingEthereum,
        uint256 tokensMinted,
        address indexed referredBy
    );
    
    event onTokenSell(
        address indexed customerAddress,
        uint256 tokensBurned,
        uint256 ethereumEarned
    );
    
    event onReinvestment(
        address indexed customerAddress,
        uint256 ethereumReinvested,
        uint256 tokensMinted
    );
    
    event onWithdraw(
        address indexed customerAddress,
        uint256 ethereumWithdrawn
    );    

    // only people with tokens
    modifier onlyContractUsers() {
        require(getUserTokenBalance(msg.sender) > 0);
        _;
    }
    
    // only people with profits
    modifier onlyRewardOwners() {
        require(userReward(true) > 0);
        _;
    }
    
    // administrators can:
    // -> change the name of the contractч
    // -> change the name of the token
    // -> change the PoS difficulty (How many tokens it costs to hold a masternode, in case it gets crazy high later)
    // they CANNOT:
    // -> take funds
    // -> disable withdrawals
    // -> kill the contract
    // -> change the price of tokens
    modifier onlyAdministrator() {
        require(_administrators[keccak256(msg.sender)]);
        _;
    }



    function GoldmintPowh(address mntpTokenAddress) public {
        _mntpToken = IMNTP(mntpTokenAddress);
    }


    /**
     * Converts incoming eth to tokens
     */
    function buy(address refAddress) public payable returns(uint256) {
        purchaseTokens(msg.value, refAddress);
    }
    
    /**
     * Fallback function to handle ethereum that was send straight to the contract
     */
    function() payable public {
        purchaseTokens(msg.value, 0x0);
    }

    /**
     * Converts all of caller's reward to tokens.
     */
    function reinvest() onlyRewardOwners() public {
        // fetch reward
        uint256 reward = userReward(false); // retrieve ref. bonus later in the code
        
        // pay out the reward virtually
        _rewardPayouts[msg.sender] +=  (int256) (reward * MAGNITUDE);
        
        // retrieve ref. bonus
        reward += _referralBalances[msg.sender];
        _referralBalances[msg.sender] = 0;
        
        // dispatch a buy order with the virtualized "withdrawn reward"
        uint256 tokens = purchaseTokens(reward, 0x0);
        
        // fire event
        onReinvestment(msg.sender, reward, tokens);
    }

     /**
     * Withdraws all of the callers earnings.
     */
    function withdraw() onlyRewardOwners() public {
        uint256 reward = userReward(false); // get ref. bonus later in the code
        
        // update dividend tracker
        _rewardPayouts[msg.sender] +=  (int256) (reward * MAGNITUDE);
        
        // add ref. bonus
        reward += _referralBalances[msg.sender];
        _referralBalances[msg.sender] = 0;
        
        // lambo delivery service
        msg.sender.transfer(reward);
        
        // fire event
        onWithdraw(msg.sender, reward);
    }
    
    /**
     * sell tokens for eth
     */
    function sell(uint256 tokenAmount) onlyContractUsers() public {
        require(tokenAmount <= getCurrentUserTokenBalance());

        uint256 payout = 0; uint256 ethAmount = 0; uint256 totalFeeEth = 0; uint256 taxedEth = 0;

        (payout, ethAmount, totalFeeEth, taxedEth) = estimateSellOrder(tokenAmount);

        subUserTokens(msg.sender, tokenAmount);

        msg.sender.transfer(payout);
        
        addProfitPerShare(totalFeeEth);
        
        onTokenSell(msg.sender, tokenAmount, payout);
    }   



    /* HELPERS */
    function getTotalEthBalance() public view returns(uint256) {
        return this.balance;
    }
    
    function getTotalTokenSupply() public view returns(uint256) {
        return _mntpToken.balanceOf(address(this));
    }
    
    function getUserTokenBalance(address userAddress) public view returns(uint256) {
        return _userTokenBalances[userAddress];
    }
    
    function getCurrentUserTokenBalance() public view returns(uint256) {
        return getUserTokenBalance(msg.sender);
    }    

    /**
     * Retrieve the reward owned by the caller.
     * If `_includeReferralBonus` is to to 1/true, the referral bonus will be included in the calculations.
     * The reason for this, is that in the frontend, we will want to get the total divs (global + ref)
     * But in the internal calculations, we want them separate. 
     */ 
    function userReward(bool _includeReferralBonus) public view returns(uint256) {
        return _includeReferralBonus ? rewardOf(msg.sender) + _referralBalances[msg.sender] : rewardOf(msg.sender) ;
    }    


    /**
     * Retrieve the dividend balance of any single address.
     */
    function rewardOf(address userAddress) view public returns(uint256) {
        return (uint256) ((int256)(_bonusPerMntp * _userTokenBalances[userAddress]) - _rewardPayouts[userAddress]) / MAGNITUDE;
    }
    
    function get1TokenSellPrice() public view returns(uint256) {
        // our calculation relies on the token supply, so we need supply. Doh.
        if(getTotalTokenSupply() == 0){
            return TOKEN_PRICE_INITIAL - TOKEN_PRICE_INC;
        } else {
            uint256 payout = 0; uint256 ethAmount = 0; uint256 totalFeeEth = 0; uint256 taxedEth = 0;
            (payout, ethAmount, totalFeeEth, taxedEth) = estimateSellOrder(1e18);

            return taxedEth;
        }
    }
    
    function get1TokenBuyPrice() public view returns(uint256) {
        // our calculation relies on the token supply, so we need supply. Doh.
        if(getTotalTokenSupply() == 0){
            return TOKEN_PRICE_INITIAL + TOKEN_PRICE_INC;
        } else {
            uint256 tokenAmount = 0; uint256 totalFeeEth = 0; uint256 taxedEth = 0;
            (tokenAmount, totalFeeEth, taxedEth) = estimateBuyOrder(1e18);  

            return taxedEth;
        }
    }

    function calculateReward(uint256 tokenAmount) public view returns(uint256) {
        return (uint256) ((int256)(_bonusPerMntp * tokenAmount)) / MAGNITUDE;
    }  


    function estimateBuyOrder(uint256 ethAmount) public view returns(uint256, uint256, uint256) {
        uint256 totalFeeEth = getTotalFee(ethAmount);
        uint256 taxedEth = SafeMath.sub(ethAmount, totalFeeEth);
        uint256 tokenAmount = ethToTokens(taxedEth);

        return (tokenAmount, totalFeeEth, taxedEth);
    }
    

    function estimateSellOrder(uint256 tokenAmount) public view returns(uint256, uint256, uint256, uint256) {
        uint256 ethAmount = tokensToEth(tokenAmount);
        uint256 totalFeeEth = getTotalFee(ethAmount);
        uint256 taxedEth = SafeMath.sub(ethAmount, totalFeeEth);

        uint256 payout = (uint256)((uint256)(_bonusPerMntp * tokenAmount + (taxedEth * MAGNITUDE)) / MAGNITUDE);
        
        return (payout, ethAmount, totalFeeEth, taxedEth);
    }

    function getUserMaxPurchase(address userAddress) public view returns(uint256) {
        return _mntpToken.balanceOf(userAddress) - getUserTokenBalance(userAddress);
    }
    
    function getCurrentUserMaxPurchase() public view returns(uint256) {
        return getUserMaxPurchase(msg.sender);
    }
    
    /*==========================================
    =            INTERNAL FUNCTIONS            =
    ==========================================*/
    function purchaseTokens(uint256 ethAmount, address refAddress) internal returns(uint256) {
        uint256 tokenAmount = 0; uint256 totalFeeEth = 0; uint256 taxedEth = 0;
        (tokenAmount, totalFeeEth, taxedEth) = estimateBuyOrder(ethAmount);

        require(tokenAmount > 0 && (SafeMath.add(tokenAmount, getTotalTokenSupply()) > getTotalTokenSupply()));
        
        // refferal program
        if (refAddress != 0x0 && refAddress != msg.sender && getUserTokenBalance(refAddress) >= MIN_REF_TOKEN_AMOUNT) {
            uint256 refBonusEth = getRefBonus(totalFeeEth);
            totalFeeEth = SafeMath.sub(totalFeeEth, refBonusEth);
            _referralBalances[refAddress] = SafeMath.add(_referralBalances[refAddress], refBonusEth);
        }
        
        uint256 fee = totalFeeEth * MAGNITUDE;

        if (getTotalTokenSupply() > 0) {
            // take the amount of dividends gained through this transaction, and allocates them evenly to each shareholder
            addProfitPerShare(totalFeeEth);
            
            // calculate the amount of tokens the customer receives over his purchase 
            fee = fee - (fee - tokenAmount * totalFeeEth * MAGNITUDE / getTotalTokenSupply());
        }
        
        // update circulating supply & the ledger address for the customer
        addUserTokens(msg.sender, tokenAmount);

        // Tells the contract that the buyer doesn't deserve dividends for the tokens before they owned them;
        _rewardPayouts[msg.sender] += (int256)(_bonusPerMntp * tokenAmount - fee);

        
        onTokenPurchase(msg.sender, ethAmount, tokenAmount, refAddress);
        
        return tokenAmount;
    }

    function addProfitPerShare(uint256 totalFee) internal {
        if (getTotalTokenSupply() == 0) return;

        uint256 totalShareReward = getTotalShareRewardFee(totalFee);
        _bonusPerMntp = SafeMath.add(_bonusPerMntp, (totalShareReward * MAGNITUDE) / getTotalTokenSupply());
    }

    function subProfitPerShare(uint256 totalFee) internal {
        if (getTotalTokenSupply() == 0) return;

        uint256 totalShareReward = getTotalShareRewardFee(totalFee);
        _bonusPerMntp = SafeMath.sub(_bonusPerMntp, (totalShareReward * MAGNITUDE) / getTotalTokenSupply());
    }    

    function addUserTokens(address user, uint256 tokenAmount) internal returns(bool) {
        _userTokenBalances[user] = SafeMath.add(_userTokenBalances[user], tokenAmount);  
        _mntpToken.transfer(msg.sender, tokenAmount);

        return true;     
    }

    function subUserTokens(address user, uint256 tokenAmount) internal returns(bool) {
        _userTokenBalances[user] = SafeMath.sub(_userTokenBalances[user], tokenAmount);  
        _mntpToken.transferFrom(user, address(this), tokenAmount);

        return true;     
    }  

    /**
     * Calculate Token price based on an amount of incoming ethereum
     * It's an algorithm, hopefully we gave you the whitepaper with it in scientific notation;
     * Some conversions occurred to prevent decimal errors or underflows / overflows in solidity code.
     */
    function ethToTokens(uint256 ethAmount) internal view returns(uint256) {
        uint256 tokenPriceInitial = TOKEN_PRICE_INITIAL * 1e18;
        uint256 tokensReceived = 
         (
            (
                // underflow attempts BTFO
                SafeMath.sub(
                    (SafeMath.sqrt
                        (
                            (tokenPriceInitial**2)
                            +
                            (2*(TOKEN_PRICE_INC * 1e18)*(ethAmount * 1e18))
                            +
                            (((TOKEN_PRICE_INC)**2)*(getTotalTokenSupply()**2))
                            +
                            (2*(TOKEN_PRICE_INC)*tokenPriceInitial*getTotalTokenSupply())
                        )
                    ), tokenPriceInitial
                )
            )/(TOKEN_PRICE_INC)
        )-(getTotalTokenSupply())
        ;
  
        return tokensReceived;
    }

    function tokensToEth(uint256 tokenAmount) internal view returns(uint256) {
        uint256 tokens = (tokenAmount + 1e18);
        uint256 ethAmount =
        (
            SafeMath.sub(
                (
                    (
                        (
                            TOKEN_PRICE_INITIAL + (TOKEN_PRICE_INC * (getTotalTokenSupply()/1e18))
                        )-TOKEN_PRICE_INC
                    )*(tokens - 1e18)
                ),(TOKEN_PRICE_INC*((tokens**2-tokens)/1e18))/2
            )
        /1e18);

        return ethAmount;
    }

    function getTotalFee(uint256 ethAmount) internal returns(uint256) {
        return calcPercent(ethAmount, TOTAL_FEE_PERCENT);
    } 

    function getTotalShareRewardFee(uint256 totalFee) internal pure returns(uint256) {
        return calcPercent(totalFee, SHARE_REWARD_PERCENT);
    }
    
    function getRefBonus(uint256 totalFee) internal pure returns(uint256) {
        return calcPercent(totalFee, REF_BONUS_PERCENT);
    }
    
    function calcPercent(uint256 amount, uint8 percent) internal pure returns(uint256) {
        return SafeMath.mul(SafeMath.div(amount, 100), percent);
    }

}


contract IMNTP {
    function balanceOf(address _owner) public constant returns (uint256);
    function transfer(address _to, uint256 _value) public returns (bool);
    function transferFrom(address _from, address _to, uint256 _value) public returns(bool);
}

library SafeMath {

    /**
    * @dev Multiplies two numbers, throws on overflow.
    */
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) {
            return 0;
        }
        uint256 c = a * b;
        assert(c / a == b);
        return c;
    }

    /**
    * @dev Integer division of two numbers, truncating the quotient.
    */
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        // assert(b > 0); // Solidity automatically throws when dividing by 0
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold
        return c;
    }

    /**
    * @dev Substracts two numbers, throws on overflow (i.e. if subtrahend is greater than minuend).
    */
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        assert(b <= a);
        return a - b;
    }

    /**
    * @dev Adds two numbers, throws on overflow.
    */
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        assert(c >= a);
        return c;
    }

    function sqrt(uint x) internal pure returns (uint y) {
        uint z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }        
}