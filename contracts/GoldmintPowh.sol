pragma solidity ^0.4.18;

contract GoldmintPowh {

    IMNTP _mntpTokenContract;

    uint256 constant internal MAGNITUDE = 2**64;

    uint8 constant internal _rewardFeePart = 10;
    uint8 constant _refBonusPart = 3;

    uint256 constant internal _tokenPriceInitial = 0.01 ether;
    uint256 constant internal _tokenPriceIncremental = 0.00000001 ether;
    

    // proof of stake (defaults at 100 tokens)
    uint256 public _stakingRequirement = 100e18;

    
    // ambassador program
    mapping(address => bool) internal _ambassadors;
    uint256 constant internal _ambassadorMaxPurchase = 1 ether;
    uint256 constant internal _ambassadorQuota = 20 ether;


    mapping(address => uint256) internal _userTokenBalances;
    mapping(address => uint256) internal _referralBalance;
    mapping(address => int256) internal _payoutsTo;
    mapping(address => uint256) internal _ambassadorAccumulatedQuota;    

    mapping(bytes32 => bool) public _administrators;
    
    uint256 internal _profitPerShare;
    uint256 internal _totalTokenAmount = 1000000000000000000000;    
    
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
    modifier onlyAdministrator(){
        require(_administrators[keccak256(msg.sender)]);
        _;
    }



    function GoldmintPowh(address mntpTokenAddress) public {
        _mntpTokenContract = IMNTP(mntpTokenAddress);
    }


    /**
     * Converts incoming eth to tokens
     */
    function buy(address refAddress) public payable returns(uint256)
    {
        purchaseTokens(msg.value, refAddress);
    }
    
    /**
     * Fallback function to handle ethereum that was send straight to the contract
     */
    function() payable public
    {
        purchaseTokens(msg.value, 0x0);
    }

    /**
     * Converts all of caller's reward to tokens.
     */
    function reinvest() onlyRewardOwners() public
    {
        // fetch reward
        uint256 reward = userReward(false); // retrieve ref. bonus later in the code
        
        // pay out the reward virtually
        _payoutsTo[msg.sender] +=  (int256) (reward * MAGNITUDE);
        
        // retrieve ref. bonus
        reward += _referralBalance[msg.sender];
        _referralBalance[msg.sender] = 0;
        
        // dispatch a buy order with the virtualized "withdrawn reward"
        uint256 tokens = purchaseTokens(reward, 0x0);
        
        // fire event
        onReinvestment(msg.sender, reward, tokens);
    }

     /**
     * Withdraws all of the callers earnings.
     */
    function withdraw() onlyRewardOwners() public
    {
        uint256 reward = userReward(false); // get ref. bonus later in the code
        
        // update dividend tracker
        _payoutsTo[msg.sender] +=  (int256) (reward * MAGNITUDE);
        
        // add ref. bonus
        reward += _referralBalance[msg.sender];
        _referralBalance[msg.sender] = 0;
        
        // lambo delivery service
        msg.sender.transfer(reward);
        
        // fire event
        onWithdraw(msg.sender, reward);
    }
    
    /**
     * Liquifies tokens to ethereum.
     */
    function sell(uint256 tokenAmount) onlyContractUsers() public
    {
        require(tokenAmount <= _userTokenBalances[msg.sender]);

        uint256 ethAmount = tokensToEth(tokenAmount);
        uint256 ethReward = getRewardFee(ethAmount);
        uint256 taxEth = SafeMath.sub(ethAmount, ethReward);
        
        _totalTokenAmount = SafeMath.sub(_totalTokenAmount, tokenAmount);
        _userTokenBalances[msg.sender] = SafeMath.sub(_userTokenBalances[msg.sender], tokenAmount);
        _mntpTokenContract.transferFrom(msg.sender, address(this), tokenAmount);
        
        // update reward tracker
        int256 _updatedPayouts = (int256) (_profitPerShare * tokenAmount + (taxEth * MAGNITUDE));
        _payoutsTo[msg.sender] -= _updatedPayouts;       
        
        // dividing by zero is a bad idea
        if (getTotalTokenBalance() > 0) {
            // update the amount of reward per token
            _profitPerShare = SafeMath.add(_profitPerShare, (ethReward * MAGNITUDE) / getTotalTokenBalance());
        }
        
        // fire event
        onTokenSell(msg.sender, tokenAmount, taxEth);
    }   



    /* HELPERS */


    function getTotalEthBalance() public view returns(uint)
    {
        return this.balance;
    }
    
    /**
     * Retrieve the total token supply.
     */
    function getTotalTokenBalance() public view returns(uint256)
    {
        return _totalTokenAmount;//_mntpTokenContract.balanceOf(address(this));
    }
    
    /**
     * Retrieve the tokens owned by the caller.
     */
    function getUserTokenBalance(address userAddress) public view returns(uint256)
    {
        return _userTokenBalances[userAddress];
    }
    
    function getCurrentUserTokenBalance() public view returns(uint256)
    {
        return getUserTokenBalance(msg.sender);
    }    

    /**
     * Retrieve the reward owned by the caller.
     * If `_includeReferralBonus` is to to 1/true, the referral bonus will be included in the calculations.
     * The reason for this, is that in the frontend, we will want to get the total divs (global + ref)
     * But in the internal calculations, we want them separate. 
     */ 
    function userReward(bool _includeReferralBonus) public view returns(uint256) {
        return _includeReferralBonus ? rewardOf(msg.sender) + _referralBalance[msg.sender] : rewardOf(msg.sender) ;
    }    


    /**
     * Retrieve the dividend balance of any single address.
     */
    function rewardOf(address userAddress) view public returns(uint256) {
        return (uint256) ((int256)(_profitPerShare * _userTokenBalances[userAddress]) - _payoutsTo[userAddress]) / MAGNITUDE;
    }
    
    /**
     * Return the buy price of 1 individual token.
     */
    function sellPrice() public view returns(uint256)
    {
        // our calculation relies on the token supply, so we need supply. Doh.
        if(getTotalTokenBalance() == 0){
            return _tokenPriceInitial - _tokenPriceIncremental;
        } else {
            uint256 ethAmount = tokensToEth(1e18);
            uint256 reward = getRewardFee(ethAmount);
            return SafeMath.sub(ethAmount, reward);
        }
    }
    
    /**
     * Return the sell price of 1 individual token.
     */
    function buyPrice() public view returns(uint256)
    {
        // our calculation relies on the token supply, so we need supply. Doh.
        if(getTotalTokenBalance() == 0){
            return _tokenPriceInitial + _tokenPriceIncremental;
        } else {
            uint256 ethAmount = tokensToEth(1e18);
            uint256 reward = getRewardFee(ethAmount);
            return SafeMath.add(ethAmount, reward);
        }
    }


   /**
     * dynamically retrieve the price scaling of buy orders.
     */
    function estimateBuyOrder(uint256 ethAmount) public view returns(uint256)
    {
        uint256 reward = getRewardFee(ethAmount);
        uint256 taxedEth = SafeMath.sub(ethAmount, reward);
        return ethToTokens(taxedEth);
    }
    
    /**
     * dynamically retrieve the price scaling of sell orders.
     */
    function estimateSellOrder(uint256 tokensToSell) public view returns(uint256)
    {
        //require(tokensToSell <= getTotalTokenBalance());
        uint256 ethAmount = tokensToEth(tokensToSell);
        uint256 reward = getRewardFee(ethAmount);
        return SafeMath.sub(ethAmount, reward);
    }

    function getUserMaxPurchase(address userAddress) public view returns(uint256)
    {
        return _mntpTokenContract.balanceOf(userAddress) - getUserTokenBalance(userAddress);
    }
    
    function getCurrentUserMaxPurchase() public view returns(uint256)
    {
        return getUserMaxPurchase(msg.sender);
    }
    
    /*==========================================
    =            INTERNAL FUNCTIONS            =
    ==========================================*/
    function purchaseTokens(uint256 ethAmount, address refAddress) internal returns(uint256)
    {
        uint256 ethReward = getRewardFee(ethAmount);
        uint256 ethRefBonus = getRefBonus(ethReward);
        uint256 tokenAmount = ethToTokens(SafeMath.sub(ethAmount, ethReward));

        ethReward = SafeMath.sub(ethReward, ethRefBonus);

        require(tokenAmount > 0 && (SafeMath.add(tokenAmount, getTotalTokenBalance()) > getTotalTokenBalance()));
        
        // is the user referred by a masternode?
        if (refAddress != 0x0 &&  refAddress != msg.sender &&
            // does the referrer have at least X whole tokens?
            // i.e is the referrer a godly chad masternode
            _userTokenBalances[refAddress] >= _stakingRequirement
        ){
            // wealth redistribution
            _referralBalance[refAddress] = SafeMath.add(_referralBalance[refAddress], ethRefBonus);
        } else {
            // no ref purchase
            // add the referral bonus back to the global dividends cake
            ethReward = SafeMath.add(ethReward, ethRefBonus);
        }
        
        uint256 fee = ethReward * MAGNITUDE;

        // we can't give people infinite ethereum
        if(getTotalTokenBalance() > 0) {
            
            _totalTokenAmount = SafeMath.add(_totalTokenAmount, tokenAmount);
            //_mntpTokenContract.transfer(msg.sender, tokenAmount);
            

            // take the amount of dividends gained through this transaction, and allocates them evenly to each shareholder
            _profitPerShare += ethReward * MAGNITUDE / getTotalTokenBalance();
            
            // calculate the amount of tokens the customer receives over his purchase 
            fee = fee - (fee - tokenAmount * ethReward * MAGNITUDE / getTotalTokenBalance());
        
        } else {
            // add tokens to the pool
            //tokenSupply_ = _amountOfTokens;
        }
        
        // update circulating supply & the ledger address for the customer
        _userTokenBalances[msg.sender] = SafeMath.add(_userTokenBalances[msg.sender], tokenAmount);
        _mntpTokenContract.transfer(msg.sender, tokenAmount);
        
        // Tells the contract that the buyer doesn't deserve dividends for the tokens before they owned them;
        _payoutsTo[msg.sender] += (int256)(_profitPerShare * tokenAmount - fee);
        
        // fire event
        onTokenPurchase(msg.sender, ethAmount, tokenAmount, refAddress);
        
        return tokenAmount;
    }

    /**
     * Calculate Token price based on an amount of incoming ethereum
     * It's an algorithm, hopefully we gave you the whitepaper with it in scientific notation;
     * Some conversions occurred to prevent decimal errors or underflows / overflows in solidity code.
     */
    function ethToTokens(uint256 ethAmount) internal view returns(uint256)
    {
        uint256 tokenPriceInitial = _tokenPriceInitial * 1e18;
        uint256 tokensReceived = 
         (
            (
                // underflow attempts BTFO
                SafeMath.sub(
                    (sqrt
                        (
                            (tokenPriceInitial**2)
                            +
                            (2*(_tokenPriceIncremental * 1e18)*(ethAmount * 1e18))
                            +
                            (((_tokenPriceIncremental)**2)*(getTotalTokenBalance()**2))
                            +
                            (2*(_tokenPriceIncremental)*tokenPriceInitial*getTotalTokenBalance())
                        )
                    ), tokenPriceInitial
                )
            )/(_tokenPriceIncremental)
        )-(getTotalTokenBalance())
        ;
  
        return tokensReceived;
    }

    function tokensToEth(uint256 tokenAmount) public view returns(uint256)
    {
        uint256 tokens = (tokenAmount + 1e18);
        uint256 ethAmount =
        (
            SafeMath.sub(
                (
                    (
                        (
                            _tokenPriceInitial + (_tokenPriceIncremental * (getTotalTokenBalance()/1e18))
                        )-_tokenPriceIncremental
                    )*(tokens - 1e18)
                ),(_tokenPriceIncremental*((tokens**2-tokens)/1e18))/2
            )
        /1e18);

        return ethAmount;
    }

    function getRewardFee(uint256 amount) internal pure returns(uint256) {
      return SafeMath.div(amount, _rewardFeePart);
    }
    
    function getRefBonus(uint256 amount) internal pure returns(uint256) {
      return SafeMath.div(amount, _refBonusPart);
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
}