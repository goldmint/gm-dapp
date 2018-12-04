pragma solidity ^0.4.25;

contract IStdToken {
    function balanceOf(address _owner) public view returns (uint256);
    function transfer(address _to, uint256 _value) public returns (bool);
    function transferFrom(address _from, address _to, uint256 _value) public returns(bool);
}

contract EtheramaCommon {
    
    //main adrministrators of the Etherama network
    mapping(address => bool) private _administrators;

    //main managers of the Etherama network
    mapping(address => bool) private _managers;

    
    modifier onlyAdministrator() {
        require(_administrators[msg.sender]);
        _;
    }

    modifier onlyAdministratorOrManager() {
        require(_administrators[msg.sender] || _managers[msg.sender]);
        _;
    }
    
    constructor() public {
        _administrators[msg.sender] = true;
    }
    
    
    function addAdministator(address addr) onlyAdministrator public {
        _administrators[addr] = true;
    }

    function removeAdministator(address addr) onlyAdministrator public {
        _administrators[addr] = false;
    }

    function addManager(address addr) onlyAdministrator public {
        _managers[addr] = true;
    }

    function removeManager(address addr) onlyAdministrator public {
        _managers[addr] = false;
    }
}


contract EtheramaGasPriceLimit is EtheramaCommon {
    
    uint256 public MAX_GAS_PRICE = 0 wei;
    
    event onSetMaxGasPrice(uint256 val);    
    
    //max gas price modifier for buy/sell transactions in order to avoid a "front runner" vulnerability.
    //It is applied to all network contracts
    modifier validGasPrice(uint256 val) {
        require(val > 0);
        _;
    }
    
    constructor(uint256 maxGasPrice) public validGasPrice(maxGasPrice) {
        setMaxGasPrice(maxGasPrice);
    } 
    
    function getMaxGasPrice() public view returns(uint256) {
        return MAX_GAS_PRICE;
    }
    
    //only main administators or managers can set max gas price
    function setMaxGasPrice(uint256 val) public validGasPrice(val) onlyAdministratorOrManager {
        MAX_GAS_PRICE = val;
        
        emit onSetMaxGasPrice(val);
    }
}

// Core contract for Etherama network
contract EtheramaCore is EtheramaGasPriceLimit {
    
    uint256 constant public MAGNITUDE = 2**64;

    // Max and min amount of tokens which can be bought or sold. There are such limits because of math precision
    uint256 constant public MIN_TOKEN_DEAL_VAL = 0.1 ether;
    uint256 constant public MAX_TOKEN_DEAL_VAL = 1000000 ether;

    // same same for ETH
    uint256 constant public MIN_ETH_DEAL_VAL = 0.001 ether;
    uint256 constant public MAX_ETH_DEAL_VAL = 200000 ether;
    
    // percent of a transaction commission which is taken for Big Promo bonus
    uint256 private _bigPromoPercent = 5 ether;

    // percent of a transaction commission which is taken for Quick Promo bonus
    uint256 private _quickPromoPercent = 5 ether;

    // percent of a transaction commission which is taken for Etherama DEV team
    uint256 private _devRewardPercent = 15 ether;
    

    // interval of blocks for Big Promo bonus. It means that a user which buy a bunch of tokens for X ETH in that particular block will receive a special bonus 
    uint128 private _bigPromoBlockInterval = 9999;

    // same same for Quick Promo
    uint128 private _quickPromoBlockInterval = 100;

    uint256 private _currentBigPromoBonus;
    uint256 private _currentQuickPromoBonus;
    uint256 private _totalCollectedPromoBonus;
    
    uint256 private _currentDevReward;

    uint256 private _promoMinPurchaseEth = 1 ether;
    
    mapping(address => bool) private _controllerContracts;
    
    uint256 private _initBlockNum;

    
    modifier onlyControllerContract() {
        require(_controllerContracts[msg.sender]);
        _;
    }
    
    constructor(uint256 maxGasPrice) EtheramaGasPriceLimit(maxGasPrice) public { 
         _initBlockNum = block.number;
    }
    
    function getInitBlockNum() public view returns (uint256) {
        return _initBlockNum;
    }
    
    function addControllerContract(address addr) onlyAdministrator public {
        _controllerContracts[addr] = true;
    }

    function removeControllerContract(address addr) onlyAdministrator public {
        _controllerContracts[addr] = false;
    }
    

    function setBigPromoInterval(uint128 val) onlyAdministrator public {
        _bigPromoBlockInterval = val;
    }
    
    function getBigPromoInterval() public view returns(uint256) {
        return _bigPromoBlockInterval;
    }

    function setQuickPromoInterval(uint128 val) onlyAdministrator public {
        _quickPromoBlockInterval = val;
    }
    
    function getQuickPromoInterval() public view returns(uint256) {
        return _quickPromoBlockInterval;
    }
    
    function addBigPromoBonus() onlyControllerContract payable public {
        _currentBigPromoBonus = SafeMath.add(_currentBigPromoBonus, msg.value);
        addTotalCollectedPromoBonus(msg.value);
    }
    
    function getCurrentBigPromoBonus() public view returns (uint256) {
        return _currentBigPromoBonus;
    } 
    
    function addQuickPromoBonus() onlyControllerContract payable public {
        _currentQuickPromoBonus = SafeMath.add(_currentQuickPromoBonus, msg.value);
        addTotalCollectedPromoBonus(msg.value);
    }
    
    function getCurrentQuickPromoBonus() public view returns (uint256) {
        return _currentQuickPromoBonus;
    } 
    
    
    function addTotalCollectedPromoBonus(uint256 val) internal {
        _totalCollectedPromoBonus = SafeMath.add(_totalCollectedPromoBonus, val);
    }
    
    function getTotalCollectedPromoBonus() public view returns (uint256) {
        return _totalCollectedPromoBonus;
    }    


    function getBigPromoPercent() public view returns(uint256) {
        return _bigPromoPercent;
    }
    
    function getQuickPromoPercent() public view returns(uint256) {
        return _quickPromoPercent;
    }
    
    function getDevRewardPercent() public view returns(uint256) {
        return _devRewardPercent;
    }    

    function setPromoMinPurchaseEth(uint256 val) onlyAdministrator public {
        _promoMinPurchaseEth = val;
    }
    
    function getPromoMinPurchaseEth() public view returns(uint256) {
        return _promoMinPurchaseEth;
    } 

    function setRewardPercentages(uint256 bigPromoPercent, uint256 quickPromoPercent) onlyAdministrator public {
        _bigPromoPercent = bigPromoPercent;
        _quickPromoPercent = quickPromoPercent;
    }
    
    function transferQuickBonus(address userAddress) onlyControllerContract public {
        Etherama(msg.sender).acceptQuickPromoBonusTransfer.value(getCurrentQuickPromoBonus())(userAddress);
        _currentQuickPromoBonus = 0;
    }
    
    function transferBigBonus(address userAddress) onlyControllerContract public {
        Etherama(msg.sender).acceptBigPromoBonusTransfer.value(getCurrentBigPromoBonus())(userAddress);
        _currentBigPromoBonus = 0;
    }

    function getDevReward() public view returns(uint256) {
        return _currentDevReward;
    }

    function addDevReward() onlyControllerContract payable public {
        _currentDevReward = SafeMath.add(_currentDevReward, msg.value);
    }    
    
    function withdrawDevReward() onlyAdministrator public {
        msg.sender.transfer(_currentDevReward);

        _currentDevReward = 0;
    }
    
}

// Data contract for Etherama contract controller. Data contract cannot be changed so no data can be lost. On the other hand Etherama controller can be replaced if some error is found.
contract EtheramaData {

    address private _tokenContractAddress;
    
    // token price in the begining
    uint256 constant private TOKEN_PRICE_INITIAL = 0.001 ether;

    // percent of a transaction commission which is taken for Token Owner. 
    uint256 private _tokenOwnerRewardPercent = 30 ether;

    // percent of a transaction commission which is taken for share reward. Each token holder receives a small reward from each buy or sell transaction proportionally his holding. 
    uint256 private _shareRewardPercent = 25 ether;

    // percent of a transaction commission which is taken for a feraral link owner. If there is no any referal then this part of commission goes to share reward.
    uint256 private _refBonusPercent = 20 ether;

    // a percent of the token price which adds/subs each _priceSpeedInterval tokens
    uint64 private _priceSpeedPercent = 5;
    // Token price speed interval. For instance, if _priceSpeedPercent = 5 and _priceSpeedInterval = 10000 it means that after 10000 tokens are bought/sold  token price will increase/decrease for 5%.
    uint64 private _priceSpeedInterval = 10000;

    
    mapping(address => uint256) private _userTokenBalances;
    mapping(address => uint256) private _refBalances;
    mapping(address => uint256) private _rewardPayouts;
    mapping(address => uint256) private _promoQuickBonuses;
    mapping(address => uint256) private _promoBigBonuses;

    mapping(address => bool) private _administrators;
    uint256 private  _administratorCount;


    // percent of fee which is supposed to distribute.
    uint256 private _totalIncomeFeePercent = 100 ether;

    // minimum token amount which is required to get a referal link.
    uint256 private _minRefTokenAmount = 1 ether;
    uint64 private _initTime;
    uint64 private _expirationTime;
    uint256 private _bonusPerShare;
    uint256 private _tokenOwnerReward;
    
    uint256 private _totalSupply;
    int128 private _realTokenPrice;

    address private _controllerAddress = address(0x0);

    EtheramaCore private _core;

    uint256 private _buyCount;
    uint256 private _sellCount;
    uint256 private _totalVolumeEth;
    uint256 private _totalVolumeToken;

    uint256 private _initBlockNum;
    
    bool private _hasMaxPurchaseLimit = true;
    
    IStdToken _token;

    //only main contract
    modifier onlyController() {
        require(msg.sender == _controllerAddress);
        _;
    }

    constructor(address coreAddress) public {
        require(coreAddress != address(0x0));

        _controllerAddress = msg.sender;
        _core = EtheramaCore(coreAddress);
        _initBlockNum = block.number;
    }
    
    function init(address tokenContractAddress, uint64 expPeriodDays, int128 initRealTokenPrice, uint64 priceSpeedPercent, uint64 priceSpeedInterval) onlyController public {
        require(tokenContractAddress != address(0x0));
        require(expPeriodDays > 0);
        require(priceSpeedPercent > 0);
        require(priceSpeedInterval > 0);

        _token = IStdToken(tokenContractAddress);
        _initTime = uint64(now);
        _expirationTime = _initTime + expPeriodDays * 1 days;
        _realTokenPrice = initRealTokenPrice;
        
        _priceSpeedPercent = uint64(priceSpeedPercent);
        _priceSpeedInterval = uint64(priceSpeedInterval);
    }
    
    function getCore() public view returns(EtheramaCore) {
        return _core;
    }
    
    function getCoreAddress()  public view returns(address) {
        return address(_core);
    }
    
    function getToken() public view returns(IStdToken) {
        return _token;
    }
    
    function getMaxGasPrice() public view returns(uint256) {
        return _core.getMaxGasPrice();
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

    // set reward persentages of buy/sell fee. Token owner cannot take more than 40%.
    function setRewardPercentages(uint256 tokenOwnerRewardPercent, uint256 shareRewardPercent, uint256 refBonusPercent) onlyController public {
        require(tokenOwnerRewardPercent <= 40 ether);
        require(shareRewardPercent <= 100 ether);
        require(refBonusPercent <= 100 ether);

        require(tokenOwnerRewardPercent + shareRewardPercent + refBonusPercent + getDevRewardPercent() + getBigPromoPercent() + getQuickPromoPercent() == 100 ether);

        _tokenOwnerRewardPercent = tokenOwnerRewardPercent;
        _shareRewardPercent = shareRewardPercent;
        _refBonusPercent = refBonusPercent;
    }

    function getTokenOwnerRewardPercent() public view returns(uint256) {
        return _tokenOwnerRewardPercent;
    }
    
    function getShareRewardPercent() public view returns(uint256) {
        return _shareRewardPercent;
    }
    
    function getRefBonusPercent() public view returns(uint256) {
        return _refBonusPercent;
    }
    
    function getDevRewardPercent() public view returns(uint256) {
        return _core.getDevRewardPercent();
    }
    
    function getBigPromoPercent() public view returns(uint256) {
        return _core.getBigPromoPercent();
    }
    
    function getQuickPromoPercent() public view returns(uint256) {
        return _core.getQuickPromoPercent();
    }
    
    function getBigPromoInterval() public view returns(uint256) {
        return _core.getBigPromoInterval();
    }
    
    function getQuickPromoInterval() public view returns(uint256) {
        return _core.getQuickPromoInterval();
    }
    
    function getPromoMinPurchaseEth() public view returns(uint256) {
        return _core.getPromoMinPurchaseEth();
    }

    function getPriceSpeedPercent() public view returns(uint64) {
        return _priceSpeedPercent;
    }
    
    function getPriceSpeedInterval() public view returns(uint64) {
        return _priceSpeedInterval;
    }

    
    function addAdministator(address addr) onlyController public {
        _administrators[addr] = true;
        _administratorCount = SafeMath.add(_administratorCount, 1);
    }

    function removeAdministator(address addr) onlyController public {
        _administrators[addr] = false;
        _administratorCount = SafeMath.sub(_administratorCount, 1);
    }

    function getAdministratorCount() public view returns(uint256) {
        return _administratorCount;
    }
    
    function isAdministrator(address addr) public view returns(bool) {
        return _administrators[addr];
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
    

    function resetUserRefBalance(address addr) onlyController public {
        _refBalances[addr] = 0;
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
    

    function resetUserPromoBonus(address addr) onlyController public {
        _promoQuickBonuses[addr] = 0;
        _promoBigBonuses[addr] = 0;
    }
    
    function getUserTotalPromoBonus(address addr) public view returns (uint256) {
        return SafeMath.add(_promoQuickBonuses[addr], _promoBigBonuses[addr]);
    }
    
    function getUserQuickPromoBonus(address addr) public view returns (uint256) {
        return _promoQuickBonuses[addr];
    }
    
    function getUserBigPromoBonus(address addr) public view returns (uint256) {
        return _promoBigBonuses[addr];
    }
    
    function payoutQuickBonus(address addr) onlyController public {
        _promoQuickBonuses[addr] = SafeMath.add(_promoQuickBonuses[addr], getCurrentQuickPromoBonus());
    }
    
    function payoutBigBonus(address addr) onlyController public {
        _promoBigBonuses[addr] = SafeMath.add(_promoBigBonuses[addr], getCurrentBigPromoBonus());
    }
    
    
    function setMinRefTokenAmount(uint256 val) onlyController public {
        _minRefTokenAmount = val;
    }
    
    function getMinRefTokenAmount() public view returns (uint256) {
        return _minRefTokenAmount;
    }    

    
    function getExpirationTime() public view returns (uint256) {
        return _expirationTime;
    } 

    
    function getCommonInitBlockNum() public view returns (uint256) {
        return _core.getInitBlockNum();
    }
    
    function addBonusPerShare(uint256 val) onlyController public {
        _bonusPerShare = SafeMath.add(_bonusPerShare, val);
    }    
    
    function getBonusPerShare() public view returns (uint256) {
        return _bonusPerShare;
    }

    function resetTokenOwnerReward() onlyController public {
        _tokenOwnerReward = 0;
    }
    
    function addTokenOwnerReward(uint256 val) onlyController public {
        _tokenOwnerReward = SafeMath.add(_tokenOwnerReward, val);
    }
    
    function getTokenOwnerReward() public view returns (uint256) {
        return _tokenOwnerReward;
    }
    
    function getCurrentBigPromoBonus() public view returns (uint256) {
        return _core.getCurrentBigPromoBonus();
    }        
    

    function getCurrentQuickPromoBonus() public view returns (uint256) {
        return _core.getCurrentQuickPromoBonus();
    }    

    
    function getTotalCollectedPromoBonus() public view returns (uint256) {
        return _core.getTotalCollectedPromoBonus();
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

    function trackBuy(uint256 volEth, uint256 volToken) onlyController public {
        _buyCount = SafeMath.add(_buyCount, 1);
        trackVolume(volEth, volToken);
    }

    function trackSell(uint256 volEth, uint256 volToken) onlyController public {
        _sellCount = SafeMath.add(_sellCount, 1);
        trackVolume(volEth, volToken);
    }
    
    function trackVolume(uint256 volEth, uint256 volToken) internal {
        _totalVolumeEth = SafeMath.add(_totalVolumeEth, volEth);
        _totalVolumeToken = SafeMath.add(_totalVolumeToken, volToken);
    }

    function getBuyCount() public view returns(uint256) {
        return _buyCount;
    }

    function getSellCount() public view returns(uint256) {
        return _sellCount;
    }   
    
    function getTotalVolumeEth() public view returns(uint256) {
        return _totalVolumeEth;
    }   
    
    function getTotalVolumeToken() public view returns(uint256) {
        return _totalVolumeToken;
    } 
    
    function getHasMaxPurchaseLimit() public view returns(bool) {
        return _hasMaxPurchaseLimit;
    }
    
    function setHasMaxPurchaseLimit(bool val) onlyController public {
        _hasMaxPurchaseLimit = val;
    }
}


contract Etherama {

    IStdToken _token;
    EtheramaData _data;
    EtheramaCore _core;


    bool public isActive = false;
    bool public isMigrationToNewControllerInProgress = false;
    bool public isActualContractVer = true;

    address private _creator = address(0x0);
    

    event onTokenPurchase(address indexed userAddress, uint256 incomingEth, uint256 tokensMinted, address indexed referredBy);
    
    event onTokenSell(address indexed userAddress, uint256 tokensBurned, uint256 ethEarned);
    
    event onReinvestment(address indexed userAddress, uint256 ethReinvested, uint256 tokensMinted);
    
    event onWithdraw(address indexed userAddress, uint256 ethWithdrawn); 

    event onWithdrawTokenOwnerReward(address indexed toAddress, uint256 ethWithdrawn); 

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
    // -> change minimal amout of tokens to get a ref link.
    // administrators CANNOT:
    // -> take funds
    // -> disable withdrawals
    // -> kill the contract
    // -> change the price of tokens
    // -> suspend the contract
    modifier onlyAdministrator() {
        require(isCurrentUserAdministrator());
        _;
    }

    // only active state of the contract. Administator can activate it, but canncon deactive untill lock-up period is expired.
    modifier onlyActive() {
        require(isActive);
        _;
    }
    
    // maximum gas price for buy/sell transactions to avoid "front runner" vulnerability.
    modifier validGasPrice() {
        require(tx.gasprice <= _data.getMaxGasPrice());
        _;
    }
    
    modifier onlyCoreContract() {
        require(msg.sender == _data.getCoreAddress());
        _;
    }


    // tokenContractAddress - tranding token address
    // dataContractAddress - data contract address where all the data is collected and separated from the controller
    // coreAddress - Etherama core contract addres
    // expirationInDays - lock-up period in days. Until this period is expeired nobody can close the contract or withdraw users' funds
    // priceSpeedPercent - a percent of the token price which adds/subs each _priceSpeedInterval tokens
    // priceSpeedInterval - Token price speed interval. For instance, if priceSpeedPercent = 5 and _priceSpeedInterval = 10000 it means that after 10000 tokens are bought/sold  token price will increase/decrease for 5%.
    constructor(address tokenContractAddress, address dataContractAddress, address coreAddress, 
        uint64 expirationInDays, uint64 priceSpeedPercent, uint64 priceSpeedInterval) public {
        _data = dataContractAddress != address(0x0) ? EtheramaData(dataContractAddress) : new EtheramaData(coreAddress);
        
        if (dataContractAddress == address(0x0)) {
            _data.init(tokenContractAddress, expirationInDays, convert256ToReal(_data.getTokenInitialPrice()), priceSpeedPercent, priceSpeedInterval);
            _data.addAdministator(msg.sender);
            _creator = msg.sender;
        }
        
        _token = _data.getToken();
        _core = _data.getCore();
    }

    function addAdministator(address addr) onlyAdministrator public {
        _data.addAdministator(addr);
    }

    function removeAdministator(address addr) onlyAdministrator public {
        _data.removeAdministator(addr);
    }

    // transfer ownership of the contract to token owner from contract creator.
    function transferOwnership(address addr) onlyAdministrator public {
        addAdministator(addr);
    }

    // accept transfer ownership.
    function acceptOwnership() onlyAdministrator public {
        require(_creator != address(0x0));

        removeAdministator(_creator);

        require(_data.getAdministratorCount() == 1);
    }
    
    // if there is a maximim purchase limit then a user can buy only amount of tokens which he had before, not more.
    function setHasMaxPurchaseLimit(bool val) onlyAdministrator public {
        _data.setHasMaxPurchaseLimit(val);
    }
    
    // Activate the contract
    function activate() onlyAdministrator public {
        require(!isActive);
        
        if (getTotalTokenSupply() == 0) setTotalSupply();
        require(getTotalTokenSupply() > 0);
        
        isActive = true;
        isMigrationToNewControllerInProgress = false;
    }
    
    // Close the contract and withdraw all the funds. The contract cannot be closed before lock up period is expired.
    function finish() onlyAdministrator public {
        require(uint64(now) >= _data.getExpirationTime());
        
        _token.transfer(msg.sender, getRemainingTokenAmount());   
        msg.sender.transfer(getTotalEthBalance());
        
        isActive = false;
    }
    
    //Converts incoming eth to tokens
    function buy(address refAddress, uint256 minReturn) onlyActive validGasPrice public payable returns(uint256) {
        return purchaseTokens(msg.value, refAddress, minReturn);
    }

    //sell tokens for eth
    function sell(uint256 tokenAmount, uint256 minReturn) onlyActive onlyContractUsers validGasPrice public returns(uint256) {
        if (tokenAmount > getCurrentUserLocalTokenBalance() || tokenAmount == 0) return 0;

        uint256 ethAmount = 0; uint256 totalFeeEth = 0; uint256 tokenPrice = 0;
        (ethAmount, totalFeeEth, tokenPrice) = estimateSellOrder(tokenAmount, true);
        require(ethAmount >= minReturn);

        subUserTokens(msg.sender, tokenAmount);

        msg.sender.transfer(ethAmount);

        updateTokenPrice(-convert256ToReal(tokenAmount));

        distributeFee(totalFeeEth, address(0x0));

        _data.trackSell(ethAmount, tokenAmount);
       
        emit onTokenSell(msg.sender, tokenAmount, ethAmount);

        return ethAmount;
    }   


    //Fallback function to handle ethereum that was send straight to the contract
    function() onlyActive validGasPrice payable external {
        purchaseTokens(msg.value, address(0x0), 1);
    }

    //Converts all of caller's reward to tokens.
    function reinvest() onlyActive onlyRewardOwners validGasPrice public {
        uint256 reward = getRewardAndPrepareWithdraw();

        uint256 tokens = purchaseTokens(reward, address(0x0), 0);
        
        emit onReinvestment(msg.sender, reward, tokens);
    }

     //Withdraws all of the callers earnings.
    function withdraw() onlyActive onlyRewardOwners public {
        uint256 reward = getRewardAndPrepareWithdraw();
        
        msg.sender.transfer(reward);
        
        emit onWithdraw(msg.sender, reward);
    }

    // withdraw token owner's reward
    function withdrawTokenOwnerReward() onlyAdministrator public {
        uint256 reward = getTokenOwnerReward();
        
        require(reward > 0);
        
        _data.resetTokenOwnerReward();

        msg.sender.transfer(reward);

        emit onWithdrawTokenOwnerReward(msg.sender, reward);
    }

    // prepare the contract for migration to another one in case of some errors or refining
    function prepareForMigration() onlyAdministrator public {
        require(!isMigrationToNewControllerInProgress);
        isMigrationToNewControllerInProgress = true;
    }
    
    // accept funds to a new controller
    function transferFundsToNewController() payable public {
        require(isMigrationToNewControllerInProgress);
    }
    

    //HELPERS
    // max gas price for buy/sell transactions
    function getMaxGasPrice() public view returns(uint256) {
        return _data.getMaxGasPrice();
    }

    // time when lock-up period is expired
    function getExpirationTime() public view returns (uint256) {
        return _data.getExpirationTime();
    }

    // time till lock-up period is expired 
    function getRemainingTimeTillExpiration() public view returns (uint256) {
        if (_data.getExpirationTime() <= uint64(now)) return 0;
        
        return _data.getExpirationTime() - uint64(now);
    }

    
    function isCurrentUserAdministrator() public view returns(bool) {
        return _data.isAdministrator(msg.sender);
    }

    // data contract address where all the data is holded
    function getDataContractAddress() public view returns(address) {
        return address(_data);
    }

    // get trading token address
    function getTokenAddress() public view returns(address) {
        return address(_token);
    }

    
    //set new controller address in case of some mistake in the contract and transfer there all the tokens and eth.
    function setNewControllerContractAddress(address newControllerAddr) onlyAdministrator public {
        require(newControllerAddr != address(0x0) && isActualContractVer);

        isActive = false;

        Etherama newController = Etherama(address(newControllerAddr));
        _data.setNewControllerAddress(newControllerAddr);

        uint256 remainingTokenAmount = getRemainingTokenAmount();
        uint256 ethBalance = getTotalEthBalance();

        if (remainingTokenAmount > 0) _token.transfer(newControllerAddr, remainingTokenAmount); 
        if (ethBalance > 0) newController.transferFundsToNewController.value(ethBalance)();
        
        isActualContractVer = false;
    }

    function getBuyCount() public view returns(uint256) {
        return _data.getBuyCount();
    }

    function getSellCount() public view returns(uint256) {
        return _data.getSellCount();
    }
    
    function getTotalVolumeEth() public view returns(uint256) {
        return _data.getTotalVolumeEth();
    }   
    
    function getTotalVolumeToken() public view returns(uint256) {
        return _data.getTotalVolumeToken();
    } 
    
    function getBonusPerShare() public view returns (uint256) {
        return SafeMath.div(SafeMath.mul(_data.getBonusPerShare(), 1 ether), _core.MAGNITUDE());
    }    

    function getTokenInitialPrice() public view returns(uint256) {
        return _data.getTokenInitialPrice();
    }

    function getDevRewardPercent() public view returns(uint256) {
        return _data.getDevRewardPercent();
    }

    function getTokenOwnerRewardPercent() public view returns(uint256) {
        return _data.getTokenOwnerRewardPercent();
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

    function getBigPromoInterval() public view returns(uint256) {
        return _data.getBigPromoInterval();
    }

    function getQuickPromoInterval() public view returns(uint256) {
        return _data.getQuickPromoInterval();
    }

    function getPromoMinPurchaseEth() public view returns(uint256) {
        return _data.getPromoMinPurchaseEth();
    }


    function getPriceSpeedPercent() public view returns(uint64) {
        return _data.getPriceSpeedPercent();
    }

    function getPriceSpeedTokenBlock() public view returns(uint64) {
        return _data.getPriceSpeedInterval();
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
        return address(this).balance;
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

    function getActualUserTokenBalance(address userAddress) public view returns(uint256) {
        return SafeMath.min(_data.getUserTokenBalance(userAddress), _token.balanceOf(userAddress));
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
    
    function getCurrentUserShareReward() public view returns(uint256) {
        return getUserReward(msg.sender, false, false);
    }
    
    function getCurrentUserRefBonus() public view returns(uint256) {
        return _data.getUserRefBalance(msg.sender);
    }
    
    function getCurrentUserPromoBonus() public view returns(uint256) {
        return _data.getUserTotalPromoBonus(msg.sender);
    }
    
    function getTokenDealRange() public view returns(uint256, uint256) {
        return (_core.MIN_TOKEN_DEAL_VAL(), _core.MAX_TOKEN_DEAL_VAL());
    }

    function getEthDealRange() public view returns(uint256, uint256) {
        uint256 minTokenVal; uint256 maxTokenVal;
        (minTokenVal, maxTokenVal) = getTokenDealRange();
        
        return ( SafeMath.max(_core.MIN_ETH_DEAL_VAL(), tokensToEth(minTokenVal, true)), SafeMath.min(_core.MAX_ETH_DEAL_VAL(), tokensToEth(maxTokenVal, true)) );
    }

    function getUserReward(address userAddress, bool incRefBonus, bool incPromoBonus) public view returns(uint256) {
        uint256 reward = _data.getBonusPerShare() * getActualUserTokenBalance(userAddress);
        reward = ((reward < _data.getUserRewardPayouts(userAddress)) ? 0 : SafeMath.sub(reward, _data.getUserRewardPayouts(userAddress))) / _core.MAGNITUDE();
        
        if (incRefBonus) reward = SafeMath.add(reward, _data.getUserRefBalance(userAddress));
        if (incPromoBonus) reward = SafeMath.add(reward, _data.getUserTotalPromoBonus(userAddress));
        
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
        return (uint256) ((int256)(_data.getBonusPerShare() * tokenAmount)) / _core.MAGNITUDE();
    }  

    function estimateBuyOrder(uint256 amount, bool fromEth) public view returns(uint256, uint256, uint256) {
        uint256 minAmount; uint256 maxAmount;
        (minAmount, maxAmount) = fromEth ? getEthDealRange() : getTokenDealRange();
        //require(amount >= minAmount && amount <= maxAmount);

        uint256 ethAmount = fromEth ? amount : tokensToEth(amount, true);
        require(ethAmount > 0);

        uint256 tokenAmount = fromEth ? ethToTokens(amount, true) : amount;
        uint256 totalFeeEth = calcTotalFee(tokenAmount, true);
        require(ethAmount > totalFeeEth);

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
        require(ethAmount > totalFeeEth);

        uint256 tokenPrice = SafeMath.div(ethAmount * 1 ether, tokenAmount);
        
        return (fromToken ? ethAmount : tokenAmount, totalFeeEth, tokenPrice);
    }


    function getUserMaxPurchase(address userAddress) public view returns(uint256) {
        return _token.balanceOf(userAddress) - SafeMath.mul(getUserLocalTokenBalance(userAddress), 2);
    }
    
    function getCurrentUserMaxPurchase() public view returns(uint256) {
        return getUserMaxPurchase(msg.sender);
    }

    function getTokenOwnerReward() public view returns(uint256) {
        return _data.getTokenOwnerReward();
    }

    function getCurrentUserTotalPromoBonus() public view returns(uint256) {
        return _data.getUserTotalPromoBonus(msg.sender);
    }

    function getCurrentUserBigPromoBonus() public view returns(uint256) {
        return _data.getUserBigPromoBonus(msg.sender);
    }

    function getCurrentUserQuickPromoBonus() public view returns(uint256) {
        return _data.getUserQuickPromoBonus(msg.sender);
    }
   
    function getBlockNumSinceInit() public view returns(uint256) {
        return block.number - _data.getCommonInitBlockNum();
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
    
    function acceptQuickPromoBonusTransfer(address userAddress) onlyCoreContract payable public {
        _data.payoutQuickBonus(userAddress);
    }
    
    function acceptBigPromoBonusTransfer(address userAddress) onlyCoreContract payable public {
        _data.payoutBigBonus(userAddress);
    }
    
    
    
    // INTERNAL FUNCTIONS
    
    function purchaseTokens(uint256 ethAmount, address refAddress, uint256 minReturn) internal returns(uint256) {
        uint256 tokenAmount = 0; uint256 totalFeeEth = 0; uint256 tokenPrice = 0;
        (tokenAmount, totalFeeEth, tokenPrice) = estimateBuyOrder(ethAmount, true);
        require(tokenAmount >= minReturn);

        if (_data.getHasMaxPurchaseLimit()) {
            //user has to have at least equal amount of tokens which he's willing to buy 
            require(getCurrentUserMaxPurchase() >= tokenAmount);
        }

        require(tokenAmount > 0 && (SafeMath.add(tokenAmount, getTotalTokenSold()) > getTotalTokenSold()));

        if (refAddress == msg.sender || !isRefAvailable(refAddress)) refAddress = address(0x0);

        distributeFee(totalFeeEth, refAddress);

        addUserTokens(msg.sender, tokenAmount);

        // the user is not going to receive any reward for the current purchase
        _data.addUserRewardPayouts(msg.sender, _data.getBonusPerShare() * tokenAmount);

        checkAndSendPromoBonus(ethAmount);
        
        updateTokenPrice(convert256ToReal(tokenAmount));
        
        _data.trackBuy(ethAmount, tokenAmount);

        emit onTokenPurchase(msg.sender, ethAmount, tokenAmount, refAddress);
        
        return tokenAmount;
    }

    function setTotalSupply() internal {
        require(_data.getTotalSupply() == 0);

        uint256 tokenAmount = _token.balanceOf(address(this));

        _data.setTotalSupply(tokenAmount);
    }

    function getRewardAndPrepareWithdraw() internal returns(uint256) {
        uint256 reward = getCurrentUserReward(false, false);
        
        // add share reward to payouts
        _data.addUserRewardPayouts(msg.sender, reward * _core.MAGNITUDE());

        // add ref bonus
        reward = SafeMath.add(reward, _data.getUserRefBalance(msg.sender));
        _data.resetUserRefBalance(msg.sender);

        // add promo bonus
        reward = SafeMath.add(reward, _data.getUserTotalPromoBonus(msg.sender));
        _data.resetUserPromoBonus(msg.sender);

        return reward;
    }

    function checkAndSendPromoBonus(uint256 purchaseAmountEth) internal {
        if (purchaseAmountEth < _data.getPromoMinPurchaseEth()) return;

        if (getQuickPromoRemainingBlocks() == 0) sendQuickPromoBonus();
        if (getBigPromoRemainingBlocks() == 0) sendBigPromoBonus();
    }

    function sendQuickPromoBonus() internal {
        _core.transferQuickBonus(msg.sender);

        emit onWinQuickPromo(msg.sender, _data.getCurrentQuickPromoBonus());
    }

    function sendBigPromoBonus() internal {
        _core.transferBigBonus(msg.sender);

        emit onWinBigPromo(msg.sender, _data.getCurrentBigPromoBonus());
    }

    function distributeFee(uint256 totalFeeEth, address refAddress) internal {

        addProfitPerShare(totalFeeEth, refAddress);
        addDevReward(totalFeeEth);
        addTokenOwnerReward(totalFeeEth);
        addBigPromoBonus(totalFeeEth);
        addQuickPromoBonus(totalFeeEth);
    }

    function addProfitPerShare(uint256 totalFeeEth, address refAddress) internal {
        uint256 refBonus = calcRefBonus(totalFeeEth);
        uint256 totalShareReward = calcTotalShareRewardFee(totalFeeEth);

        if (refAddress != address(0x0)) {
            _data.addUserRefBalance(refAddress, refBonus);
        } else {
            totalShareReward = SafeMath.add(totalShareReward, refBonus);
        }

        if (getTotalTokenSold() == 0) {
            _data.addTokenOwnerReward(totalShareReward);
        } else {
            _data.addBonusPerShare((totalShareReward * _core.MAGNITUDE()) / getTotalTokenSold());
        }
    }

    function addDevReward(uint256 totalFeeEth) internal {
        _core.addDevReward.value(calcDevReward(totalFeeEth))();
    }    
    
    function addTokenOwnerReward(uint256 totalFeeEth) internal {
        _data.addTokenOwnerReward(calcTokenOwnerReward(totalFeeEth));
    }  

    function addBigPromoBonus(uint256 totalFeeEth) internal {
        _core.addBigPromoBonus.value(calcBigPromoBonus(totalFeeEth))();
    }

    function addQuickPromoBonus(uint256 totalFeeEth) internal {
        _core.addQuickPromoBonus.value(calcQuickPromoBonus(totalFeeEth))();
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
        return RealMath.div(RealMath.fraction(int64(_data.getPriceSpeedPercent()), 100), RealMath.toReal(int64(_data.getPriceSpeedInterval())));
    }


    function calcTotalShareRewardFee(uint256 totalFee) internal view returns(uint256) {
        return calcPercent(totalFee, _data.getShareRewardPercent());
    }
    
    function calcRefBonus(uint256 totalFee) internal view returns(uint256) {
        return calcPercent(totalFee, _data.getRefBonusPercent());
    }
    
    function calcTokenOwnerReward(uint256 totalFee) internal view returns(uint256) {
        return calcPercent(totalFee, _data.getTokenOwnerRewardPercent());
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

    //Converts real num to uint256. Works only with positive numbers.
    function convertRealTo256(int128 realVal) internal pure returns(uint256) {
        int128 roundedVal = RealMath.fromReal(RealMath.mul(realVal, RealMath.toReal(1e12)));

        return SafeMath.mul(uint256(roundedVal), uint256(1e6));
    }

    //Converts uint256 to real num.
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
}


