pragma solidity ^0.4.18;

contract IStdToken {
    function balanceOf(address _owner) public constant returns (uint256);
    function transfer(address _to, uint256 _value) public returns (bool);
    function transferFrom(address _from, address _to, uint256 _value) public returns(bool);
}

contract MintaramaData {

    uint256 constant private TOKEN_PRICE_INITIAL = 0.001 ether;

    uint256 private _devRewardPercent = 40 ether;
    uint256 private _shareRewardPercent = 30 ether;
    uint256 private _refBonusPercent = 20 ether;
    uint256 private _bigPromoPercent = 5 ether;
    uint256 private _quickPromoPercent = 5 ether;

    uint128 private _bigPromoBlockInterval = 9999;
    uint128 private _quickPromoBlockInterval = 100;
    uint256 private _promoMinPurchase = 100 ether;

    int64 private _priceSpeedPercent = 5;
    int64 private _priceSpeedTokenBlock = 10000;

    
    mapping(address => uint256) private _userTokenBalances;
    mapping(address => uint256) private _refBalances;
    mapping(address => uint256) private _rewardPayouts;
    mapping(address => uint256) private _promoBonuses;

    mapping(bytes32 => bool) private _administrators;


    uint256 private _totalIncomeFeePercent = 100 ether;
    uint256 private _minRefTokenAmount = 1 ether;
    uint256 private _initBlockNum;
    uint64 private _initTime;
    uint64 private _expirationPeriodDays;
    uint256 private _bonusPerShare;
    uint256 private _devReward;
    uint256 private _currentBigPromoBonus;
    uint256 private _currentQuickPromoBonus;
    uint256 private _totalCollectedPromoBonus;

    
    uint256 private _totalSupply;
    int128 private _realTokenPrice;

    address private _controllerAddress = 0x0;

    //only main contract
    modifier onlyController() {
        require(msg.sender == _controllerAddress);
        _;
    }

    function MintaramaData() public {
        _controllerAddress = msg.sender;
    }

    function setNewControllerAddress(address newAddress) onlyController public {
        _controllerAddress = newAddress;
    }

    function getControllerAddress() public view returns(address) {
        return _controllerAddress;
    }
        
    function getTokenInitialPrice() public pure returns(uint256) {
        return TOKEN_PRICE_INITIAL;
    }

    function setRewardPercentages(uint256 devRewardPercent, uint256 shareRewardPercent, uint256 refBonusPercent, uint256 bigPromoPercent, uint256 quickPromoPercent) onlyController public {
        require(devRewardPercent <= 40 ether);
        require(devRewardPercent + shareRewardPercent + refBonusPercent + bigPromoPercent + quickPromoPercent == 100 ether);

        _devRewardPercent = devRewardPercent;
        _shareRewardPercent = shareRewardPercent;
        _refBonusPercent = refBonusPercent;
        _bigPromoPercent = bigPromoPercent;
        _quickPromoPercent = quickPromoPercent;
    }
    
    function getDevRewardPercent() public view returns(uint256) {
        return _devRewardPercent;
    }
    
    function getShareRewardPercent() public view returns(uint256) {
        return _shareRewardPercent;
    }
    
    function getRefBonusPercent() public view returns(uint256) {
        return _refBonusPercent;
    }
    
    function getBigPromoPercent() public view returns(uint256) {
        return _bigPromoPercent;
    }
    
    function getQuickPromoPercent() public view returns(uint256) {
        return _quickPromoPercent;
    }
    
    
    function setBigPromoInterval(uint128 val) onlyController public {
        _bigPromoBlockInterval = val;
    }
    
    function getBigPromoInterval() public view returns(uint256) {
        return _bigPromoBlockInterval;
    }

    function setQuickPromoInterval(uint128 val) onlyController public {
        _quickPromoBlockInterval = val;
    }
    
    function getQuickPromoInterval() public view returns(uint256) {
        return _quickPromoBlockInterval;
    }    

    function setPromoMinTokenPurchase(uint256 val) onlyController public {
        _promoMinPurchase = val;
    }
    
    function getPromoMinTokenPurchase() public view returns(uint256) {
        return _promoMinPurchase;
    }
    
    function setPriceSpeed(uint64 speedPercent, uint64 speedTokenBlock) onlyController public {
        _priceSpeedPercent = int64(speedPercent);
        _priceSpeedTokenBlock = int64(speedTokenBlock);
    }

    function getPriceSpeedPercent() public view returns(int64) {
        return _priceSpeedPercent;
    }
    
    function getPriceSpeedTokenBlock() public view returns(int64) {
        return _priceSpeedTokenBlock;
    }

    
    function addAdministator(address addr) onlyController public {
        _administrators[keccak256(addr)] = true;
    }

    function removeAdministator(address addr) onlyController public {
        _administrators[keccak256(addr)] = false;
    }
    
    function isAdministrator(address addr) public view returns(bool) {
        return _administrators[keccak256(addr)];
    }

    function setTotalIncomeFeePercent(uint256 val) onlyController public {
        require(val > 0 && val <= 100 ether);

        _totalIncomeFeePercent = val;
    }
    
    function getTotalIncomeFeePercent() public view returns(uint256) {
        return _totalIncomeFeePercent;
    }

    
    function addUserTokenBalance(address addr, uint256 val) onlyController public {
        _userTokenBalances[addr] = SafeMath.add(_userTokenBalances[addr], val);
    }
    
    function subUserTokenBalance(address addr, uint256 val) onlyController public {
        _userTokenBalances[addr] = SafeMath.sub(_userTokenBalances[addr], val);
    }
    
    function getUserTokenBalance(address addr) public view returns (uint256) {
        return _userTokenBalances[addr];
    }
    

    function setUserRefBalance(address addr, uint256 val) onlyController public {
        _refBalances[addr] = val;
    }
    
    function addUserRefBalance(address addr, uint256 val) onlyController public {
        _refBalances[addr] = SafeMath.add(_refBalances[addr], val);
    }
    
    function getUserRefBalance(address addr) public view returns (uint256) {
        return _refBalances[addr];
    }    
    

    function setUserRewardPayouts(address addr, uint256 val) onlyController public {
        _rewardPayouts[addr] = val;
    }
    
    function addUserRewardPayouts(address addr, uint256 val) onlyController public {
        _rewardPayouts[addr] = SafeMath.add(_rewardPayouts[addr], val);
    }    
    
    function getUserRewardPayouts(address addr) public view returns (uint256) {
        return _rewardPayouts[addr];
    }
    

    function setUserPromoBonus(address addr, uint256 val) onlyController public {
        _promoBonuses[addr] = val;
    }
    
    function addUserPromoBonus(address addr, uint256 val) onlyController public {
        _promoBonuses[addr] = SafeMath.add(_promoBonuses[addr], val);
    }  
    
    function getUserPromoBonus(address addr) public view returns (uint256) {
        return _promoBonuses[addr];
    }
    
    
    function setMinRefTokenAmount(uint256 val) onlyController public {
        _minRefTokenAmount = val;
    }
    
    function getMinRefTokenAmount() public view returns (uint256) {
        return _minRefTokenAmount;
    }    

    function init(uint64 expPeriodDays, int128 init_realTokenPrice) onlyController public {
        _initBlockNum = block.number;
        _initTime = uint64(now);
        _expirationPeriodDays = _initTime + expPeriodDays * 1 days;
        _realTokenPrice = init_realTokenPrice;
    }
    
    function getExpirationPeriodDays() public view returns (uint256) {
        return _expirationPeriodDays;
    } 
    
    function getInitBlockNum() public view returns (uint256) {
        return _initBlockNum;
    }
    
    function addBonusPerShare(uint256 val) onlyController public {
        _bonusPerShare = SafeMath.add(_bonusPerShare, val);
    }    
    
    function getBonusPerShare() public view returns (uint256) {
        return _bonusPerShare;
    }

    function setDevReward(uint256 val) onlyController public {
        _devReward = val;
    }
    
    function addDevReward(uint256 val) onlyController public {
        _devReward = SafeMath.add(_devReward, val);
    }
    
    function getDevReward() public view returns (uint256) {
        return _devReward;
    }


    function setCurrentBigPromoBonus(uint256 val) onlyController public {
        _currentBigPromoBonus = val;
    }
    
    function addCurrentBigPromoBonus(uint256 val) onlyController public {
        _currentBigPromoBonus = SafeMath.add(_currentBigPromoBonus, val);
    }
    
    function getCurrentBigPromoBonus() public view returns (uint256) {
        return _currentBigPromoBonus;
    }        
    

    function setCurrentQuickPromoBonus(uint256 val) onlyController public {
        _currentQuickPromoBonus = val;
    }
    
    function addCurrentQuickPromoBonus(uint256 val) onlyController public {
        _currentQuickPromoBonus = SafeMath.add(_currentQuickPromoBonus, val);
    }
    
    function getCurrentQuickPromoBonus() public view returns (uint256) {
        return _currentQuickPromoBonus;
    }    
    

    function setTotalCollectedPromoBonus(uint256 val) onlyController public {
        _totalCollectedPromoBonus = val;
    }
    
    function addTotalCollectedPromoBonus(uint256 val) onlyController public {
        _totalCollectedPromoBonus = SafeMath.add(_totalCollectedPromoBonus, val);
    }
    
    function getTotalCollectedPromoBonus() public view returns (uint256) {
        return _totalCollectedPromoBonus;
    }    


    function setTotalSupply(uint256 val) onlyController public {
        _totalSupply = val;
    }
    
    function getTotalSupply() public view returns (uint256) {
        return _totalSupply;
    }
    

    function setRealTokenPrice(int128 val) onlyController public {
        _realTokenPrice = val;
    }    
    
    function getRealTokenPrice() public view returns (int128) {
        return _realTokenPrice;
    }
}

contract Mintarama {

    IStdToken _token;
    MintaramaData _data;

    uint256 constant internal MAGNITUDE = 2**64;

    uint256 constant internal MIN_TOKEN_DEAL_VAL = 0.1 ether;
    uint256 constant internal MAX_TOKEN_DEAL_VAL = 1000000 ether;

    uint256 constant internal MIN_ETH_DEAL_VAL = 0.001 ether;
    uint256 constant internal MAX_ETH_DEAL_VAL = 200000 ether;

    
    bool public isActive = false;
    bool public isMigrationToNewControllerInProgress = false;

    
    int128 private _tempRealTokenPrice;

    event onTokenPurchase(address indexed userAddress, uint256 incomingEth, uint256 tokensMinted, address indexed referredBy);
    
    event onTokenSell(address indexed userAddress, uint256 tokensBurned, uint256 ethEarned);
    
    event onReinvestment(address indexed userAddress, uint256 ethReinvested, uint256 tokensMinted);
    
    event onWithdraw(address indexed userAddress, uint256 ethWithdrawn); 

    event onWithdrawDevReward(address indexed toAddress, uint256 ethWithdrawn); 

    event onWinQuickPromo(address indexed userAddress, uint256 ethWon);    
   
    event onWinBigPromo(address indexed userAddress, uint256 ethWon);    


    // only people with tokens
    modifier onlyContractUsers() {
        require(getUserLocalTokenBalance(msg.sender) > 0);
        _;
    }
    
    // only people with profits
    modifier onlyRewardOwners() {
        require(getCurrentUserReward(true, true) > 0);
        _;
    }

    // administrators can:
    // -> change the name of the contract
    // -> change the PoS difficulty (How many tokens it costs to hold a masternode, in case it gets crazy high later)
    // they CANNOT:
    // -> take funds
    // -> disable withdrawals
    // -> kill the contract
    // -> change the price of tokens
    modifier onlyAdministrator() {
        require(isCurrentUserAdministrator());
        _;
    }

    modifier onlyActive() {
        require(isActive);
        _;
    }

    function Mintarama(address erc20TokenAddress, address dataContractAddress, uint64 expirationInDays) public {
        _token = IStdToken(erc20TokenAddress);
        
        _data = dataContractAddress != 0x0 ? MintaramaData(dataContractAddress) : new MintaramaData();
        
        if (dataContractAddress == 0x0) {
            _data.init(expirationInDays, convert256ToReal(_data.getTokenInitialPrice()));
            _data.addAdministator(msg.sender);
        }
    }

    function addAdministator(address addr) onlyAdministrator public {
        _data.addAdministator(addr);
    }

    function removeAdministator(address addr) onlyAdministrator public {
        _data.removeAdministator(addr);
    }
        
    function setActive(bool val) onlyAdministrator public {
        require(isActive != val);
        isActive = val;
    }
    
    function finish() onlyAdministrator public {
        require(uint(now) >= _data.getExpirationPeriodDays());
        
        _token.transfer(msg.sender, getRemainingTokenAmount());   
        msg.sender.transfer(getTotalEthBalance());
        
        isActive = false;
    }

    /**
     * Converts incoming eth to tokens
     */
    function buy(address refAddress) onlyActive public payable returns(uint256) {
        return purchaseTokens(msg.value, refAddress);
    }

    /**
     * sell tokens for eth
     */
    function sell(uint256 tokenAmount) onlyActive onlyContractUsers public returns(uint256) {
        if (tokenAmount > getCurrentUserLocalTokenBalance() || tokenAmount == 0) return;

        uint256 ethAmount = 0; uint256 totalFeeEth = 0; uint256 tokenPrice = 0;
        (ethAmount, totalFeeEth, tokenPrice) = estimateSellOrder(tokenAmount, true);

        subUserTokens(msg.sender, tokenAmount);

        msg.sender.transfer(ethAmount);

        updateTokenPrice(-convert256ToReal(tokenAmount));

        distributeFee(totalFeeEth, 0x0);
       
        onTokenSell(msg.sender, tokenAmount, ethAmount);

        return ethAmount;
    }   


    /**
     * Fallback function to handle ethereum that was send straight to the contract
     */
    function() onlyActive payable public {
        purchaseTokens(msg.value, 0x0);
    }

    /**
     * Converts all of caller's reward to tokens.
     */
    function reinvest() onlyActive onlyRewardOwners public {
        uint256 reward = getRewardAndPrepareWithdraw();

        uint256 tokens = purchaseTokens(reward, 0x0);
        
        onReinvestment(msg.sender, reward, tokens);
    }

     /**
     * Withdraws all of the callers earnings.
     */
    function withdraw() onlyActive onlyRewardOwners public {
        uint256 reward = getRewardAndPrepareWithdraw();
        
        msg.sender.transfer(reward);
        
        onWithdraw(msg.sender, reward);
    }

    function withdrawDevReward(address to) onlyAdministrator public {
        require(getDevReward() > 0);

        to.transfer(getDevReward());
        
        _data.setDevReward(0);

        onWithdrawDevReward(to, getDevReward());
    }

    function setMigrationStatus(bool val) onlyAdministrator public {
        require(isMigrationToNewControllerInProgress != val);
        isMigrationToNewControllerInProgress = val;
    }

    function activateNewController() payable public {
        require(isMigrationToNewControllerInProgress);
    }
    

    /* HELPERS */  
    
    function isCurrentUserAdministrator() public view returns(bool) {
        return _data.isAdministrator(msg.sender);
    }

    //data contract address where all the data is holded
    function getDataContractAddress() public view returns(address) {
        return address(_data);
    }

    function getTokenAddress() public view returns(address) {
        return address(_token);
    }

    
    //set new controller address in case of some mistake in the contract and transfer there all the tokens and eth.
    function setNewControllerContractAddress(address newControllerAddr) onlyAdministrator public {
        require(newControllerAddr != 0x0);

        isActive = false;

        Mintarama newController = Mintarama(newControllerAddr);
        _data.setNewControllerAddress(newControllerAddr);

        uint256 remainingTokenAmount = getRemainingTokenAmount();
        uint256 ethBalance = getTotalEthBalance();

        if (remainingTokenAmount > 0) _token.transfer(newControllerAddr, remainingTokenAmount); 
        if (ethBalance > 0) newController.activateNewController.value(ethBalance)();
    }

    function getTokenInitialPrice() public view returns(uint256) {
        return _data.getTokenInitialPrice();
    }

    function getDevRewardPercent() public view returns(uint256) {
        return _data.getDevRewardPercent();
    }
    
    function getShareRewardPercent() public view returns(uint256) {
        return _data.getShareRewardPercent();
    }
    
    function getRefBonusPercent() public view returns(uint256) {
        return _data.getRefBonusPercent();
    }
    
    function getBigPromoPercent() public view returns(uint256) {
        return _data.getBigPromoPercent();
    }
    
    function getQuickPromoPercent() public view returns(uint256) {
        return _data.getQuickPromoPercent();
    }

    function setBigPromoInterval(uint128 val) onlyAdministrator public {
        _data.setBigPromoInterval(val);
    }

    function getBigPromoInterval() public view returns(uint256) {
        return _data.getBigPromoInterval();
    }

    function setQuickPromoInterval(uint128 val) onlyAdministrator public {
        _data.setQuickPromoInterval(val);
    }

    function getQuickPromoInterval() public view returns(uint256) {
        return _data.getQuickPromoInterval();
    }

    function getPromoMinTokenPurchase() public view returns(uint256) {
        return _data.getPromoMinTokenPurchase();
    }

    function setPriceSpeed(uint64 speedPercent, uint64 speedTokenBlock) onlyAdministrator public {
        _data.setPriceSpeed(speedPercent, speedTokenBlock);
    }

    function getPriceSpeedPercent() public view returns(int64) {
        return _data.getPriceSpeedPercent();
    }

    function getPriceSpeedTokenBlock() public view returns(int64) {
        return _data.getPriceSpeedTokenBlock();
    }

    function setMinRefTokenAmount(uint256 val) onlyAdministrator public {
        _data.setMinRefTokenAmount(val);
    }

    function setTotalIncomeFeePercent(uint256 val) onlyAdministrator public {
        _data.setTotalIncomeFeePercent(val);
    }

    function getMinRefTokenAmount() public view returns (uint256) {
        return _data.getMinRefTokenAmount();
    }    

    function getTotalCollectedPromoBonus() public view returns (uint256) {
        return _data.getTotalCollectedPromoBonus();
    }   

    function getCurrentBigPromoBonus() public view returns (uint256) {
        return _data.getCurrentBigPromoBonus();
    }  

    function getCurrentQuickPromoBonus() public view returns (uint256) {
        return _data.getCurrentQuickPromoBonus();
    }    

    function getCurrentTokenPrice() public view returns(uint256) {
        return convertRealTo256(_data.getRealTokenPrice());
    }

    function getTotalEthBalance() public view returns(uint256) {
        return this.balance;
    }
    
    function getTotalTokenSupply() public view returns(uint256) {
        return _data.getTotalSupply();
    }

    function getRemainingTokenAmount() public view returns(uint256) {
        return _token.balanceOf(address(this));
    }

    function getTotalTokenSold() public view returns(uint256) {
        return getTotalTokenSupply() - getRemainingTokenAmount();
    }

    function getUserLocalTokenBalance(address userAddress) public view returns(uint256) {
        return _data.getUserTokenBalance(userAddress);
    }
    
    function getCurrentUserLocalTokenBalance() public view returns(uint256) {
        return getUserLocalTokenBalance(msg.sender);
    }    

    function isRefAvailable(address refAddress) public view returns(bool) {
        return getUserLocalTokenBalance(refAddress) >= _data.getMinRefTokenAmount();
    }

    function isCurrentUserRefAvailable() public view returns(bool) {
        return isRefAvailable(msg.sender);
    }

    function getCurrentUserReward(bool incRefBonus, bool incPromoBonus) public view returns(uint256) {
        return getUserReward(msg.sender, incRefBonus, incPromoBonus);
    }
    
    function getTokenDealRange() public view returns(uint256, uint256) {
        return (MIN_TOKEN_DEAL_VAL, MAX_TOKEN_DEAL_VAL);
    }

    function getEthDealRange() public view returns(uint256, uint256) {
        uint256 minTokenVal; uint256 maxTokenVal;
        (minTokenVal, maxTokenVal) = getTokenDealRange();
        
        return ( SafeMath.max(MIN_ETH_DEAL_VAL, tokensToEth(minTokenVal, true)), SafeMath.min(MAX_ETH_DEAL_VAL, tokensToEth(maxTokenVal, true)) );
    }

    function getUserReward(address addr, bool incRefBonus, bool incPromoBonus) public view returns(uint256) {
        uint256 reward = _data.getBonusPerShare() * _data.getUserTokenBalance(addr);
        reward = ((reward < _data.getUserRewardPayouts(addr)) ? 0 : SafeMath.sub(reward, _data.getUserRewardPayouts(addr))) / MAGNITUDE;
        
        if (incRefBonus) reward = SafeMath.add(reward, _data.getUserRefBalance(addr));
        if (incPromoBonus) reward = SafeMath.add(reward, _data.getUserPromoBonus(addr));
        
        return reward;
    }
  
    function get1TokenSellPrice() public view returns(uint256) {
        uint256 tokenAmount = 1 ether;

        uint256 ethAmount = 0; uint256 totalFeeEth = 0; uint256 tokenPrice = 0;
        (ethAmount, totalFeeEth, tokenPrice) = estimateSellOrder(tokenAmount, true);

        return ethAmount;
    }
    
    function get1TokenBuyPrice() public view returns(uint256) {
        uint256 ethAmount = 1 ether;

        uint256 tokenAmount = 0; uint256 totalFeeEth = 0; uint256 tokenPrice = 0;
        (tokenAmount, totalFeeEth, tokenPrice) = estimateBuyOrder(ethAmount, true);  

        return SafeMath.div(ethAmount * 1 ether, tokenAmount);
    }

    function calcReward(uint256 tokenAmount) public view returns(uint256) {
        return (uint256) ((int256)(_data.getBonusPerShare() * tokenAmount)) / MAGNITUDE;
    }  

    function estimateBuyOrder(uint256 amount, bool fromEth) public view returns(uint256, uint256, uint256) {
        uint256 minAmount; uint256 maxAmount;
        (minAmount, maxAmount) = fromEth ? getEthDealRange() : getTokenDealRange();
        //require(amount >= minAmount && amount <= maxAmount);

        uint256 ethAmount = fromEth ? amount : tokensToEth(amount, true);
        require(ethAmount > 0);

        uint256 tokenAmount = fromEth ? ethToTokens(amount, true) : amount;
        uint256 totalFeeEth = calcTotalFee(tokenAmount, true);
        //require(ethAmount > totalFeeEth);

        uint256 taxedEth = SafeMath.sub(ethAmount, totalFeeEth);

        uint256 tokenAmountWoFee = ethToTokens(taxedEth, true);

        uint256 tokenPrice = SafeMath.div(ethAmount * 1 ether, tokenAmount);

        return (fromEth ? tokenAmount : SafeMath.add(ethAmount, totalFeeEth), totalFeeEth, tokenPrice);
    }
    
    function estimateSellOrder(uint256 amount, bool fromToken) public view returns(uint256, uint256, uint256) {
        uint256 minAmount; uint256 maxAmount;
        (minAmount, maxAmount) = fromToken ? getTokenDealRange() : getEthDealRange();
        //require(amount >= minAmount && amount <= maxAmount);

        uint256 tokenAmount = fromToken ? amount : ethToTokens(amount, false);
        require(tokenAmount > 0);
        
        uint256 ethAmount = fromToken ? tokensToEth(tokenAmount, false) : amount;
        uint256 totalFeeEth = calcTotalFee(tokenAmount, false);
        //require(ethAmount > totalFeeEth);

        uint256 tokenFee = ethToTokens(totalFeeEth, false);

        uint256 tokenPrice = SafeMath.div(ethAmount * 1 ether, tokenAmount);
        
        return (fromToken ? ethAmount : SafeMath.add(tokenAmount, tokenFee), totalFeeEth, tokenPrice);
    }


    function getUserMaxPurchase(address userAddress) public view returns(uint256) {
        return _token.balanceOf(userAddress) - SafeMath.mul(getUserLocalTokenBalance(userAddress), 2);
    }
    
    function getCurrentUserMaxPurchase() public view returns(uint256) {
        return getUserMaxPurchase(msg.sender);
    }

    function getDevReward() public view returns(uint256) {
        return _data.getDevReward();
    }

    function getCurrentUserPromoBonus() public view returns(uint256) {
        return _data.getUserPromoBonus(msg.sender);
    }

    function getCurrentUserRefBonus() public view returns(uint256) {
        return _data.getUserRefBalance(msg.sender);
    }
   
    function getBlockNumSinceInit() public view returns(uint256) {
        return block.number - _data.getInitBlockNum();
    }

    function getQuickPromoRemainingBlocks() public view returns(uint256) {
        uint256 d = getBlockNumSinceInit() % _data.getQuickPromoInterval();
        d = d == 0 ? _data.getQuickPromoInterval() : d;

        return _data.getQuickPromoInterval() - d;
    }

    function getBigPromoRemainingBlocks() public view returns(uint256) {
        uint256 d = getBlockNumSinceInit() % _data.getBigPromoInterval();
        d = d == 0 ? _data.getBigPromoInterval() : d;

        return _data.getBigPromoInterval() - d;
    }    

    // INTERNAL FUNCTIONS
    
    function purchaseTokens(uint256 ethAmount, address refAddress) internal returns(uint256) {
        if (getTotalTokenSupply() == 0) setTotalSupply();

        uint256 tokenAmount = 0; uint256 totalFeeEth = 0; uint256 tokenPrice = 0;
        (tokenAmount, totalFeeEth, tokenPrice) = estimateBuyOrder(ethAmount, true);

        //user has to have at least equal amount of tokens which he's willing to buy 
        require(getCurrentUserMaxPurchase() >= tokenAmount);

        require(tokenAmount > 0 && (SafeMath.add(tokenAmount, getTotalTokenSold()) > getTotalTokenSold()));

        if (refAddress == msg.sender || !isRefAvailable(refAddress)) refAddress = 0x0;

        distributeFee(totalFeeEth, refAddress);

        addUserTokens(msg.sender, tokenAmount);

        // the user is not going to receive any reward for the current purchase
        _data.addUserRewardPayouts(msg.sender, _data.getBonusPerShare() * tokenAmount);

        checkAndSendPromoBonus(tokenAmount);
        
        updateTokenPrice(convert256ToReal(tokenAmount));
        
        onTokenPurchase(msg.sender, ethAmount, tokenAmount, refAddress);
        
        return tokenAmount;
    }

    function setTotalSupply() internal {
        require(_data.getTotalSupply() == 0);

        uint256 tokenAmount = _token.balanceOf(address(this));

        _data.setTotalSupply(tokenAmount);
    }

    function getRewardAndPrepareWithdraw() internal returns(uint256) {
        uint256 reward = getCurrentUserReward(false, false);
        
        // update dividend tracker
        _data.addUserRewardPayouts(msg.sender, reward * MAGNITUDE);

        // add ref bonus
        reward = SafeMath.add(reward, _data.getUserRefBalance(msg.sender));
        _data.setUserRefBalance(msg.sender, 0);

        // add promo bonus
        reward = SafeMath.add(reward, _data.getUserPromoBonus(msg.sender));
        _data.setUserPromoBonus(msg.sender, 0);

        return reward;
    }

    function checkAndSendPromoBonus(uint256 purchaedTokenAmount) internal {
        if (purchaedTokenAmount < _data.getPromoMinTokenPurchase()) return;

        if (getQuickPromoRemainingBlocks() == 0) sendQuickPromoBonus();
        if (getBigPromoRemainingBlocks() == 0) sendBigPromoBonus();
    }

    function sendQuickPromoBonus() internal {
        _data.addUserPromoBonus(msg.sender, _data.getCurrentQuickPromoBonus());

        onWinQuickPromo(msg.sender, _data.getCurrentQuickPromoBonus());
        
        _data.setCurrentQuickPromoBonus(0);
    }

    function sendBigPromoBonus() internal {
        _data.addUserPromoBonus(msg.sender, _data.getCurrentBigPromoBonus());

        onWinBigPromo(msg.sender, _data.getCurrentBigPromoBonus());

        _data.setCurrentBigPromoBonus(0);
    }

    function distributeFee(uint256 totalFeeEth, address refAddress) internal {
        addProfitPerShare(totalFeeEth, refAddress);
        addDevReward(totalFeeEth);
        addBigPromoBonus(totalFeeEth);
        addQuickPromoBonus(totalFeeEth);
    }

    function addProfitPerShare(uint256 totalFeeEth, address refAddress) internal {
        uint256 refBonus = calcRefBonus(totalFeeEth);
        uint256 totalShareReward = calcTotalShareRewardFee(totalFeeEth);

        if (refAddress != 0x0) {
            _data.addUserRefBalance(refAddress, refBonus);
        } else {
            totalShareReward = SafeMath.add(totalShareReward, refBonus);
        }

        if (getTotalTokenSold() == 0) {
            _data.addDevReward(totalShareReward);
        } else {
            _data.addBonusPerShare((totalShareReward * MAGNITUDE) / getTotalTokenSold());
        }
    }

    function addDevReward(uint256 totalFeeEth) internal {
        _data.addDevReward(calcDevReward(totalFeeEth));
    }    

    function addBigPromoBonus(uint256 totalFeeEth) internal {
        uint256 bonus = calcBigPromoBonus(totalFeeEth);
        _data.addCurrentBigPromoBonus(bonus);
        _data.addTotalCollectedPromoBonus(bonus);
    }

    function addQuickPromoBonus(uint256 totalFeeEth) internal {
        uint256 bonus = calcQuickPromoBonus(totalFeeEth);
        _data.addCurrentQuickPromoBonus(bonus);
        _data.addTotalCollectedPromoBonus(bonus);
    }    

    function addUserTokens(address user, uint256 tokenAmount) internal {
        _data.addUserTokenBalance(user, tokenAmount);
        _token.transfer(msg.sender, tokenAmount);   
    }

    function subUserTokens(address user, uint256 tokenAmount) internal {
        _data.subUserTokenBalance(user, tokenAmount);
        _token.transferFrom(user, address(this), tokenAmount);    
    }

    function updateTokenPrice(int128 realTokenAmount) public {
        _data.setRealTokenPrice(calc1RealTokenRateFromRealTokens(realTokenAmount));
    }

    function ethToTokens(uint256 ethAmount, bool isBuy) internal view returns(uint256) {
        int128 realEthAmount = convert256ToReal(ethAmount);
        int128 t0 = RealMath.div(realEthAmount, _data.getRealTokenPrice());
        int128 s = getRealPriceSpeed();

        int128 tn =  RealMath.div(t0, RealMath.toReal(100));

        for (uint i = 0; i < 100; i++) {

            int128 tns = RealMath.mul(tn, s);
            int128 exptns = RealMath.exp( RealMath.mul(tns, RealMath.toReal(isBuy ? int64(1) : int64(-1))) );

            int128 tn1 = RealMath.div(
                RealMath.mul( RealMath.mul(tns, tn), exptns ) + t0,
                RealMath.mul( exptns, RealMath.toReal(1) + tns )
            );

            if (RealMath.abs(tn-tn1) < RealMath.fraction(1, 1e18)) break;

            tn = tn1;
        }

        return convertRealTo256(tn);
    }

    function tokensToEth(uint256 tokenAmount, bool isBuy) internal view returns(uint256) {
        int128 realTokenAmount = convert256ToReal(tokenAmount);
        int128 s = getRealPriceSpeed();
        int128 expArg = RealMath.mul(RealMath.mul(realTokenAmount, s), RealMath.toReal(isBuy ? int64(1) : int64(-1)));
        
        int128 realEthAmountFor1Token = RealMath.mul(_data.getRealTokenPrice(), RealMath.exp(expArg));
        int128 realEthAmount = RealMath.mul(realTokenAmount, realEthAmountFor1Token);

        return convertRealTo256(realEthAmount);
    }

    function calcTotalFee(uint256 tokenAmount, bool isBuy) internal view returns(uint256) {
        int128 realTokenAmount = convert256ToReal(tokenAmount);
        int128 factor = RealMath.toReal(isBuy ? int64(1) : int64(-1));
        int128 rateAfterDeal = calc1RealTokenRateFromRealTokens(RealMath.mul(realTokenAmount, factor));
        int128 delta = RealMath.div(rateAfterDeal - _data.getRealTokenPrice(), RealMath.toReal(2));
        int128 fee = RealMath.mul(realTokenAmount, delta);
        
        return convertRealTo256(RealMath.mul(fee, factor));
    }



    function calc1RealTokenRateFromRealTokens(int128 realTokenAmount) internal view returns(int128) {
        int128 expArg = RealMath.mul(realTokenAmount, getRealPriceSpeed());

        return RealMath.mul(_data.getRealTokenPrice(), RealMath.exp(expArg));
    }
    
    function getRealPriceSpeed() internal view returns(int128) {
        return RealMath.div(RealMath.fraction(_data.getPriceSpeedPercent(), 100), RealMath.toReal(_data.getPriceSpeedTokenBlock()));
    }


    function calcTotalShareRewardFee(uint256 totalFee) internal view returns(uint256) {
        return calcPercent(totalFee, _data.getShareRewardPercent());
    }
    
    function calcRefBonus(uint256 totalFee) internal view returns(uint256) {
        return calcPercent(totalFee, _data.getRefBonusPercent());
    }

    function calcDevReward(uint256 totalFee) internal view returns(uint256) {
        return calcPercent(totalFee, _data.getDevRewardPercent());
    }

    function calcQuickPromoBonus(uint256 totalFee) internal view returns(uint256) {
        return calcPercent(totalFee, _data.getQuickPromoPercent());
    }    

    function calcBigPromoBonus(uint256 totalFee) internal view returns(uint256) {
        return calcPercent(totalFee, _data.getBigPromoPercent());
    }        
    
    function calcPercent(uint256 amount, uint256 percent) public pure returns(uint256) {
        return SafeMath.div(SafeMath.mul(SafeMath.div(amount, 100), percent), 1 ether);
    }

    /*
    * Converts real num to uint256. Works only with positive numbers.
    */
    function convertRealTo256(int128 realVal) internal pure returns(uint256) {
        int128 roundedVal = RealMath.fromReal(RealMath.mul(realVal, RealMath.toReal(1e12)));

        return SafeMath.mul(uint256(roundedVal), uint256(1e6));
    }

    /*
    * Converts uint256 to real num.
    */
    function convert256ToReal(uint256 val) internal pure returns(int128) {
        return RealMath.fraction(int64(SafeMath.div(val, 1e6)), 1e12);
    }

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

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }   

    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? b : a;
    }   
}


//taken from https://github.com/NovakDistributed/macroverse/blob/master/contracts/RealMath.sol and a bit modified
library RealMath {
    
    /**
     * How many total bits are there?
     */
    int256 constant REAL_BITS = 128;
    
    /**
     * How many fractional bits are there?
     */
    int256 constant REAL_FBITS = 64;
    
    /**
     * How many integer bits are there?
     */
    int256 constant REAL_IBITS = REAL_BITS - REAL_FBITS;
    
    /**
     * What's the first non-fractional bit
     */
    int128 constant REAL_ONE = int128(1) << REAL_FBITS;
    
    /**
     * What's the last fractional bit?
     */
    int128 constant REAL_HALF = REAL_ONE >> 1;
    
    /**
     * What's two? Two is pretty useful.
     */
    int128 constant REAL_TWO = REAL_ONE << 1;
    
    /**
     * And our logarithms are based on ln(2).
     */
    int128 constant REAL_LN_TWO = 762123384786;
    
    /**
     * It is also useful to have Pi around.
     */
    int128 constant REAL_PI = 3454217652358;
    
    /**
     * And half Pi, to save on divides.
     * TODO: That might not be how the compiler handles constants.
     */
    int128 constant REAL_HALF_PI = 1727108826179;
    
    /**
     * And two pi, which happens to be odd in its most accurate representation.
     */
    int128 constant REAL_TWO_PI = 6908435304715;
    
    /**
     * What's the sign bit?
     */
    int128 constant SIGN_MASK = int128(1) << 127;
    

    /**
     * Convert an integer to a real. Preserves sign.
     */
    function toReal(int64 ipart) internal pure returns (int128) {
        return int128(ipart) * REAL_ONE;
    }
    
    /**
     * Convert a real to an integer. Preserves sign.
     */
    function fromReal(int128 real_value) internal pure returns (int64) {
        return int64(real_value / REAL_ONE);
    }
    
    
    /**
     * Get the absolute value of a real. Just the same as abs on a normal int128.
     */
    function abs(int128 real_value) internal pure returns (int128) {
        if (real_value > 0) {
            return real_value;
        } else {
            return -real_value;
        }
    }
    
    
    /**
     * Get the fractional part of a real, as a real. Ignores sign (so fpart(-0.5) is 0.5).
     */
    function fpart(int128 real_value) internal pure returns (int128) {
        // This gets the fractional part but strips the sign
        return abs(real_value) % REAL_ONE;
    }

    /**
     * Get the fractional part of a real, as a real. Respects sign (so fpartSigned(-0.5) is -0.5).
     */
    function fpartSigned(int128 real_value) internal pure returns (int128) {
        // This gets the fractional part but strips the sign
        int128 fractional = fpart(real_value);
        return real_value < 0 ? -fractional : fractional;
    }
    
    /**
     * Get the integer part of a fixed point value.
     */
    function ipart(int128 real_value) internal pure returns (int128) {
        // Subtract out the fractional part to get the real part.
        return real_value - fpartSigned(real_value);
    }
    
    /**
     * Multiply one real by another. Truncates overflows.
     */
    function mul(int128 real_a, int128 real_b) internal pure returns (int128) {
        // When multiplying fixed point in x.y and z.w formats we get (x+z).(y+w) format.
        // So we just have to clip off the extra REAL_FBITS fractional bits.
        return int128((int256(real_a) * int256(real_b)) >> REAL_FBITS);
    }
    
    /**
     * Divide one real by another real. Truncates overflows.
     */
    function div(int128 real_numerator, int128 real_denominator) internal pure returns (int128) {
        // We use the reverse of the multiplication trick: convert numerator from
        // x.y to (x+z).(y+w) fixed point, then divide by denom in z.w fixed point.
        return int128((int256(real_numerator) * REAL_ONE) / int256(real_denominator));
    }
    
    /**
     * Create a real from a rational fraction.
     */
    function fraction(int64 numerator, int64 denominator) internal pure returns (int128) {
        return div(toReal(numerator), toReal(denominator));
    }
    
    // Now we have some fancy math things (like pow and trig stuff). This isn't
    // in the RealMath that was deployed with the original Macroverse
    // deployment, so it needs to be linked into your contract statically.
    
    /**
     * Raise a number to a positive integer power in O(log power) time.
     * See <https://stackoverflow.com/a/101613>
     */
    function ipow(int128 real_base, int64 exponent) internal pure returns (int128) {
        if (exponent < 0) {
            // Negative powers are not allowed here.
            revert();
        }
        
        // Start with the 0th power
        int128 real_result = REAL_ONE;
        while (exponent != 0) {
            // While there are still bits set
            if ((exponent & 0x1) == 0x1) {
                // If the low bit is set, multiply in the (many-times-squared) base
                real_result = mul(real_result, real_base);
            }
            // Shift off the low bit
            exponent = exponent >> 1;
            // Do the squaring
            real_base = mul(real_base, real_base);
        }
        
        // Return the final result.
        return real_result;
    }
    
    /**
     * Zero all but the highest set bit of a number.
     * See <https://stackoverflow.com/a/53184>
     */
    function hibit(uint256 val) internal pure returns (uint256) {
        // Set all the bits below the highest set bit
        val |= (val >>  1);
        val |= (val >>  2);
        val |= (val >>  4);
        val |= (val >>  8);
        val |= (val >> 16);
        val |= (val >> 32);
        val |= (val >> 64);
        val |= (val >> 128);
        return val ^ (val >> 1);
    }
    
    /**
     * Given a number with one bit set, finds the index of that bit.
     */
    function findbit(uint256 val) internal pure returns (uint8 index) {
        index = 0;
        // We and the value with alternating bit patters of various pitches to find it.
        
        if (val & 0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA != 0) {
            // Picth 1
            index |= 1;
        }
        if (val & 0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC != 0) {
            // Pitch 2
            index |= 2;
        }
        if (val & 0xF0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0 != 0) {
            // Pitch 4
            index |= 4;
        }
        if (val & 0xFF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00 != 0) {
            // Pitch 8
            index |= 8;
        }
        if (val & 0xFFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000 != 0) {
            // Pitch 16
            index |= 16;
        }
        if (val & 0xFFFFFFFF00000000FFFFFFFF00000000FFFFFFFF00000000FFFFFFFF00000000 != 0) {
            // Pitch 32
            index |= 32;
        }
        if (val & 0xFFFFFFFFFFFFFFFF0000000000000000FFFFFFFFFFFFFFFF0000000000000000 != 0) {
            // Pitch 64
            index |= 64;
        }
        if (val & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000000000000000000000000000 != 0) {
            // Pitch 128
            index |= 128;
        }
    }
    
    /**
     * Shift real_arg left or right until it is between 1 and 2. Return the
     * rescaled value, and the number of bits of right shift applied. Shift may be negative.
     *
     * Expresses real_arg as real_scaled * 2^shift, setting shift to put real_arg between [1 and 2).
     *
     * Rejects 0 or negative arguments.
     */
    function rescale(int128 real_arg) internal pure returns (int128 real_scaled, int64 shift) {
        if (real_arg <= 0) {
            // Not in domain!
            revert();
        }
        
        // Find the high bit
        int64 high_bit = findbit(hibit(uint256(real_arg)));
        
        // We'll shift so the high bit is the lowest non-fractional bit.
        shift = high_bit - int64(REAL_FBITS);
        
        if (shift < 0) {
            // Shift left
            real_scaled = real_arg << -shift;
        } else if (shift >= 0) {
            // Shift right
            real_scaled = real_arg >> shift;
        }
    }
    
    /**
     * Calculate the natural log of a number. Rescales the input value and uses
     * the algorithm outlined at <https://math.stackexchange.com/a/977836> and
     * the ipow implementation.
     *
     * Lets you artificially limit the number of iterations.
     *
     * Note that it is potentially possible to get an un-converged value; lack
     * of convergence does not throw.
     */
    function lnLimited(int128 real_arg, int max_iterations) internal pure returns (int128) {
        if (real_arg <= 0) {
            // Outside of acceptable domain
            revert();
        }
        
        if (real_arg == REAL_ONE) {
            // Handle this case specially because people will want exactly 0 and
            // not ~2^-39 ish.
            return 0;
        }
        
        // We know it's positive, so rescale it to be between [1 and 2)
        int128 real_rescaled;
        int64 shift;
        (real_rescaled, shift) = rescale(real_arg);
        
        // Compute the argument to iterate on
        int128 real_series_arg = div(real_rescaled - REAL_ONE, real_rescaled + REAL_ONE);
        
        // We will accumulate the result here
        int128 real_series_result = 0;
        
        for (int64 n = 0; n < max_iterations; n++) {
            // Compute term n of the series
            int128 real_term = div(ipow(real_series_arg, 2 * n + 1), toReal(2 * n + 1));
            // And add it in
            real_series_result += real_term;
            if (real_term == 0) {
                // We must have converged. Next term is too small to represent.
                break;
            }
            // If we somehow never converge I guess we will run out of gas
        }
        
        // Double it to account for the factor of 2 outside the sum
        real_series_result = mul(real_series_result, REAL_TWO);
        
        // Now compute and return the overall result
        return mul(toReal(shift), REAL_LN_TWO) + real_series_result;
        
    }
    
    /**
     * Calculate a natural logarithm with a sensible maximum iteration count to
     * wait until convergence. Note that it is potentially possible to get an
     * un-converged value; lack of convergence does not throw.
     */
    function ln(int128 real_arg) internal pure returns (int128) {
        return lnLimited(real_arg, 100);
    }
    

     /**
     * Calculate e^x. Uses the series given at
     * <http://pages.mtu.edu/~shene/COURSES/cs201/NOTES/chap04/exp.html>.
     *
     * Lets you artificially limit the number of iterations.
     *
     * Note that it is potentially possible to get an un-converged value; lack
     * of convergence does not throw.
     */
    function expLimited(int128 real_arg, int max_iterations) internal pure returns (int128) {
        // We will accumulate the result here
        int128 real_result = 0;
        
        // We use this to save work computing terms
        int128 real_term = REAL_ONE;
        
        for (int64 n = 0; n < max_iterations; n++) {
            // Add in the term
            real_result += real_term;
            
            // Compute the next term
            real_term = mul(real_term, div(real_arg, toReal(n + 1)));
            
            if (real_term == 0) {
                // We must have converged. Next term is too small to represent.
                break;
            }
            // If we somehow never converge I guess we will run out of gas
        }
        
        // Return the result
        return real_result;
        
    }

    function expLimited(int128 real_arg, int max_iterations, int k) internal pure returns (int128) {
        // We will accumulate the result here
        int128 real_result = 0;
        
        // We use this to save work computing terms
        int128 real_term = REAL_ONE;
        
        for (int64 n = 0; n < max_iterations; n++) {
            // Add in the term
            real_result += real_term;
            
            // Compute the next term
            real_term = mul(real_term, div(real_arg, toReal(n + 1)));
            
            if (real_term == 0) {
                // We must have converged. Next term is too small to represent.
                break;
            }

            if (n == k) return real_term;

            // If we somehow never converge I guess we will run out of gas
        }
        
        // Return the result
        return real_result;
        
    }

    /**
     * Calculate e^x with a sensible maximum iteration count to wait until
     * convergence. Note that it is potentially possible to get an un-converged
     * value; lack of convergence does not throw.
     */
    function exp(int128 real_arg) internal pure returns (int128) {
        return expLimited(real_arg, 100);
    }
    
    /**
     * Raise any number to any power, except for negative bases to fractional powers.
     */
    function pow(int128 real_base, int128 real_exponent) internal pure returns (int128) {
        if (real_exponent == 0) {
            // Anything to the 0 is 1
            return REAL_ONE;
        }
        
        if (real_base == 0) {
            if (real_exponent < 0) {
                // Outside of domain!
                revert();
            }
            // Otherwise it's 0
            return 0;
        }
        
        if (fpart(real_exponent) == 0) {
            // Anything (even a negative base) is super easy to do to an integer power.
            
            if (real_exponent > 0) {
                // Positive integer power is easy
                return ipow(real_base, fromReal(real_exponent));
            } else {
                // Negative integer power is harder
                return div(REAL_ONE, ipow(real_base, fromReal(-real_exponent)));
            }
        }
        
        if (real_base < 0) {
            // It's a negative base to a non-integer power.
            // In general pow(-x^y) is undefined, unless y is an int or some
            // weird rational-number-based relationship holds.
            revert();
        }
        
        // If it's not a special case, actually do it.
        return exp(mul(real_exponent, ln(real_base)));
    }
    
    /**
     * Compute the square root of a number.
     */
    function sqrt(int128 real_arg) internal pure returns (int128) {
        return pow(real_arg, REAL_HALF);
    }
     
}


