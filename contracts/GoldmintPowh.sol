pragma solidity ^0.4.18;

contract GoldmintPowh {

    IMNTP _mntpToken;

    uint256 constant internal MAGNITUDE = 2**64;

    uint8 constant internal TOTAL_FEE_PERCENT = 10;

    uint8 constant internal DEV_REWARD_PERCENT = 40;
    uint8 constant internal MNTP_REWARD_PERCENT = 30;
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
    mapping(address => uint256) internal _rewardPayouts;
    mapping(address => uint256) internal _ambassadorAccumulatedQuota;    

    mapping(bytes32 => bool) public _administrators;
    
    uint256 internal _totalSupply;

    uint256 internal _bonusPerMntp;
    uint256 internal _devReward;
    
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
        require(getUserReward(true) > 0);
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
        _administrators[keccak256(msg.sender)] = true;
    }
    
    function setTotalSupply(uint256 totalTokenAmount) public onlyAdministrator {
        uint256 tokenAmount = _mntpToken.balanceOf(address(this));
        
        require(_totalSupply == 0 && tokenAmount == totalTokenAmount);

        _totalSupply = totalTokenAmount;
    }

    /**
     * Converts incoming eth to tokens
     */
    function buy(address refAddress) public payable returns(uint256){
        return purchaseTokens(msg.value, refAddress);
    }

    /**
     * Fallback function to handle ethereum that was send straight to the contract
     */
    function() public payable {
        purchaseTokens(msg.value, 0x0);
    }

    /**
     * Converts all of caller's reward to tokens.
     */
    function reinvest() onlyRewardOwners() public {
        // fetch reward
        uint256 reward = getUserReward(false); // retrieve ref. bonus later in the code
        
        // pay out the reward virtually
        _rewardPayouts[msg.sender] = SafeMath.add(_rewardPayouts[msg.sender], reward * MAGNITUDE);
        
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
    function withdraw() /*onlyRewardOwners()*/ public {
        if (getUserReward(true) == 0) return;

        uint256 reward = getUserReward(false);
        
        // update dividend tracker
        _rewardPayouts[msg.sender] = SafeMath.add(_rewardPayouts[msg.sender], reward * MAGNITUDE);
        
        // add ref. bonus
        reward = SafeMath.add(reward, _referralBalances[msg.sender]);
        _referralBalances[msg.sender] = 0;
        
        msg.sender.transfer(reward);
        
        onWithdraw(msg.sender, reward);
    }
    
    /**
     * sell tokens for eth
     */
    function sell(uint256 tokenAmount) onlyContractUsers() public returns(uint256) {
        if (tokenAmount > getCurrentUserTokenBalance() || tokenAmount == 0) return;

        uint256 taxedEth = 0; uint256 ethAmount = 0; uint256 totalFeeEth = 0;

        (taxedEth, ethAmount, totalFeeEth) = estimateSellOrder(tokenAmount);

        
        subUserTokens(msg.sender, tokenAmount);

        // add reward to the user for the transaction
        //_rewardPayouts[msg.sender] -= (int256) (tokenAmount * _bonusPerMntp);
        distributeFee(totalFeeEth, 0x0);

        msg.sender.transfer(taxedEth);
        
        onTokenSell(msg.sender, tokenAmount, taxedEth);

        return taxedEth;
    }   



    /* HELPERS */

    function getTotalFeePercent() public pure returns(uint256) {
        return TOTAL_FEE_PERCENT;
    }

    function getDevRewardPercent() public pure returns(uint256) {
        return DEV_REWARD_PERCENT;
    }

    function getShareRewardPercent() public pure returns(uint256) {
        return MNTP_REWARD_PERCENT;
    }   

    function getRefBonusPercent() public pure returns(uint256) {
        return REF_BONUS_PERCENT;
    }   

    function getBigPromoPercent() public pure returns(uint256) {
        return BIG_PROMO_PERCENT;
    }   

    function getQuickPromoPercent() public pure returns(uint256) {
        return QUICK_PROMO_PERCENT;
    }  

    function getTotalEthBalance() public view returns(uint256) {
        return this.balance;
    }
    
    function getTotalTokenSupply() public view returns(uint256) {
        return _totalSupply;
    }

    function getRemainTokenAmount() public view returns(uint256) {
        return _mntpToken.balanceOf(address(this));
    }

    function getTotalTokenSold() public view returns(uint256) {
        return _totalSupply - getRemainTokenAmount();
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
    function getUserReward(bool includeRefBonus) public view returns(uint256) {
        uint256 reward = _bonusPerMntp * _userTokenBalances[msg.sender];
        reward = ((reward < _rewardPayouts[msg.sender]) ? reward : SafeMath.sub(reward, _rewardPayouts[msg.sender])) / MAGNITUDE;
        
        //uint256 reward = (uint256) (_bonusPerMntp * _userTokenBalances[msg.sender] / MAGNITUDE);

        if (includeRefBonus) reward = SafeMath.add(reward, _referralBalances[msg.sender]);
        
        return reward;
    }    

    function get1TokenSellPrice() public view returns(uint256) {
        // our calculation relies on the token supply, so we need supply. Doh.
        if(getTotalTokenSold() == 0){
            return TOKEN_PRICE_INITIAL - TOKEN_PRICE_INC;
        } else {
            uint256 taxedEth = 0; uint256 ethAmount = 0; uint256 totalFeeEth = 0; 
            (taxedEth, ethAmount, totalFeeEth) = estimateSellOrder(1e18);

            return taxedEth;
        }
    }
    
    function get1TokenBuyPrice() public view returns(uint256) {
        // our calculation relies on the token supply, so we need supply. Doh.
        if(getTotalTokenSold() == 0){
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
        uint256 totalFeeEth = calcTotalFee(ethAmount);
        uint256 taxedEth = SafeMath.sub(ethAmount, totalFeeEth);
        uint256 tokenAmount = ethToTokens(taxedEth);

        return (tokenAmount, totalFeeEth, taxedEth);
    }
    

    function estimateSellOrder(uint256 tokenAmount) public view returns(uint256, uint256, uint256) {
        uint256 ethAmount = tokensToEth(tokenAmount);
        uint256 totalFeeEth = calcTotalFee(ethAmount);
        uint256 taxedEth = SafeMath.sub(ethAmount, totalFeeEth);

        return (taxedEth, ethAmount, totalFeeEth);
    }

    function getUserMaxPurchase(address userAddress) public view returns(uint256) {
        return _mntpToken.balanceOf(userAddress) - getUserTokenBalance(userAddress);
    }
    
    function getCurrentUserMaxPurchase() public view returns(uint256) {
        return getUserMaxPurchase(msg.sender);
    }

    function getDevReward() public view returns(uint256) {
        return _devReward;
    }
    
    // INTERNAL FUNCTIONS

    function purchaseTokens(uint256 ethAmount, address refAddress) internal returns(uint256) {
        uint256 tokenAmount = 0; uint256 totalFeeEth = 0; uint256 taxedEth = 0;
        (tokenAmount, totalFeeEth, taxedEth) = estimateBuyOrder(ethAmount);

        require(tokenAmount > 0 && (SafeMath.add(tokenAmount, getTotalTokenSold()) > getTotalTokenSold()));

        if (refAddress == msg.sender || getUserTokenBalance(refAddress) < MIN_REF_TOKEN_AMOUNT) refAddress = 0x0;

        uint256 userRewardBefore = getUserReward(false);

        distributeFee(totalFeeEth, refAddress);
        
        addUserTokens(msg.sender, tokenAmount);

        // the user is not going to receive any reward for the current purchase
        _rewardPayouts[msg.sender] = SafeMath.add(_rewardPayouts[msg.sender], SafeMath.sub(getUserReward(false), userRewardBefore) * MAGNITUDE);
        
        onTokenPurchase(msg.sender, ethAmount, tokenAmount, refAddress);
        
        return tokenAmount;
    }

    function distributeFee(uint256 totalFeeEth, address refAddress) internal {

        addProfitPerShare(totalFeeEth, refAddress);
        addDevReward(totalFeeEth);
    }


    function addProfitPerShare(uint256 totalFeeEth, address refAddress) internal {
        
        if (getTotalTokenSold() == 0) return;

        uint256 refBonus = calcRefBonus(totalFeeEth);

        uint256 totalShareReward = calcTotalShareRewardFee(totalFeeEth);

        if (refAddress != 0x0) {
            _referralBalances[refAddress] = SafeMath.add(_referralBalances[refAddress], refBonus);
        } else {
            totalShareReward = SafeMath.add(totalShareReward, refBonus);
        }

        _bonusPerMntp = SafeMath.add(_bonusPerMntp, (totalShareReward * MAGNITUDE) / getTotalTokenSold());
    }


    function addDevReward(uint256 totalFeeEth) internal {
        _devReward = SafeMath.add(_devReward, calcDevReward(totalFeeEth));
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
                            (((TOKEN_PRICE_INC)**2)*(getRemainTokenAmount()**2))
                            +
                            (2*(TOKEN_PRICE_INC)*tokenPriceInitial*getRemainTokenAmount())
                        )
                    ), tokenPriceInitial
                )
            )/(TOKEN_PRICE_INC)
        )-(getRemainTokenAmount())
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
                            TOKEN_PRICE_INITIAL + (TOKEN_PRICE_INC * (getTotalTokenSold()/1e18))
                        )-TOKEN_PRICE_INC
                    )*(tokens - 1e18)
                ),(TOKEN_PRICE_INC*((tokens**2-tokens)/1e18))/2
            )
        /1e18);

        return ethAmount;
    }

    function calcTotalFee(uint256 ethAmount) internal pure returns(uint256) {
        return calcPercent(ethAmount, TOTAL_FEE_PERCENT);
    } 

    function calcTotalShareRewardFee(uint256 totalFee) internal pure returns(uint256) {
        return calcPercent(totalFee, MNTP_REWARD_PERCENT);
    }
    
    function calcRefBonus(uint256 totalFee) internal pure returns(uint256) {
        return calcPercent(totalFee, REF_BONUS_PERCENT);
    }

    function calcDevReward(uint256 totalFee) internal pure returns(uint256) {
        return calcPercent(totalFee, DEV_REWARD_PERCENT);
    }

    function calcQuickPromoBonus(uint256 totalFee) internal pure returns(uint256) {
        return calcPercent(totalFee, QUICK_PROMO_PERCENT);
    }    

    function calcBigPromoBonus(uint256 totalFee) internal pure returns(uint256) {
        return calcPercent(totalFee, BIG_PROMO_PERCENT);
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