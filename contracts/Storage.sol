pragma solidity ^0.4.19;

contract IGold {
    
    function balanceOf(address _owner) public constant returns (uint256);
    function issueTokens(address _who, uint _tokens) public;
    function burnTokens(address _who, uint _tokens) public;
}

// StdToken inheritance is commented, because no 'totalSupply' needed
contract IMNTP { /*is StdToken */

    function balanceOf(address _owner) public constant returns (uint256);

    // Additional methods that MNTP contract provides
    function lockTransfer(bool _lock) public;
    function issueTokens(address _who, uint _tokens) public;
    function burnTokens(address _who, uint _tokens) public;
}

contract SafeMath {
    
    function safeAdd(uint a, uint b) internal returns (uint) {
        uint c = a + b;
        assert(c>=a && c>=b);
        return c;
     }

    function safeSub(uint a, uint b) internal returns (uint) {
        assert(b <= a);
        return a - b;
    }

   function safeMul(uint256 a, uint256 b) internal pure returns (uint256 c) {
        if (a == 0) {
            return 0;
        }
        c = a * b;
        assert(c / a == b);

        return c;
    }

  /**
  * @dev Integer division of two numbers, truncating the quotient.
  */
  function safeDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        // assert(b > 0); // Solidity automatically throws when dividing by 0
        // uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold
        return a / b;
    }   
}

contract CreatorEnabled {
    
    address public creator = 0x0;

    modifier onlyCreator() { require(msg.sender == creator); _; }

    function changeCreator(address _to) public onlyCreator {
        creator = _to;
    }
}

contract StringMover {
    
    function stringToBytes32(string s) public constant returns(bytes32){
        bytes32 out;
        assembly {
             out := mload(add(s, 32))
        }
        return out;
    }

    function stringToBytes64(string s) public constant returns(bytes32,bytes32){
        bytes32 out;
        bytes32 out2;

        assembly {
             out := mload(add(s, 32))
             out2 := mload(add(s, 64))
        }
        return (out,out2);
    }

    function bytes32ToString(bytes32 x) public constant returns (string) {
        bytes memory bytesString = new bytes(32);
        uint charCount = 0;
        for (uint j = 0; j < 32; j++) {
             byte char = byte(bytes32(uint(x) * 2 ** (8 * j)));
             if (char != 0) {
                  bytesString[charCount] = char;
                  charCount++;
             }
        }
        bytes memory bytesStringTrimmed = new bytes(charCount);
        for (j = 0; j < charCount; j++) {
             bytesStringTrimmed[j] = bytesString[j];
        }
        return string(bytesStringTrimmed);
    }

    function bytes64ToString(bytes32 x, bytes32 y) public constant returns (string) {
        bytes memory bytesString = new bytes(64);
        uint charCount = 0;

        for (uint j = 0; j < 32; j++) {
             byte char = byte(bytes32(uint(x) * 2 ** (8 * j)));
             if (char != 0) {
                  bytesString[charCount] = char;
                  charCount++;
             }
        }
        for (j = 0; j < 32; j++) {
             char = byte(bytes32(uint(y) * 2 ** (8 * j)));
             if (char != 0) {
                  bytesString[charCount] = char;
                  charCount++;
             }
        }

        bytes memory bytesStringTrimmed = new bytes(charCount);
        for (j = 0; j < charCount; j++) {
             bytesStringTrimmed[j] = bytesString[j];
        }
        return string(bytesStringTrimmed);
    }
}


contract Storage is SafeMath, StringMover {
    
    function Storage() public {
        controllerAddress = msg.sender;
    }

    address public controllerAddress = 0x0;
    modifier onlyController() { require(msg.sender==controllerAddress); _; }

    function setControllerAddress(address _newController) public onlyController {
        controllerAddress = _newController;
    }

    address public hotWalletAddress = 0x0;

    function setHotWalletAddress(address _address) public onlyController {
       hotWalletAddress = _address;
    }


    // Fields - 1
    mapping(uint => string) docs;
    uint public docCount = 0;

    // Fields - 2
    mapping(string => mapping(uint => int)) fiatTxs;
    mapping(string => uint) fiatBalancesCents;
    mapping(string => uint) fiatTxCounts;
    uint fiatTxTotal = 0;

    // Fields - 3
    mapping(string => mapping(uint => int)) goldTxs;
    mapping(string => uint) goldHotBalances;
    mapping(string => uint) goldTxCounts;
    uint goldTxTotal = 0;

    // Fields - 4
    struct Request {
        address sender;
        string userId;
        uint reference;
        bool buyRequest;         // otherwise - sell
        uint amount;
        // 0 - init
        // 1 - processed
        // 2 - cancelled
        uint8 state;
    }

    mapping (uint=>Request) requests;
    uint public requestsCount = 0;

    ///////
    function addDoc(string _ipfsDocLink) public onlyController returns(uint) {
        docs[docCount] = _ipfsDocLink;
        uint out = docCount;
        docCount++;

        return out;
    }

    function getDocCount() public constant returns (uint) {
        return docCount;
    }

    function getDocAsBytes64(uint _index) public constant returns (bytes32,bytes32) {
        require(_index < docCount);
        return stringToBytes64(docs[_index]);
    }

    function addFiatTransaction(string _userId, int _amountCents) public onlyController returns(uint) {
        require(0 != _amountCents);

        uint c = fiatTxCounts[_userId];

        fiatTxs[_userId][c] = _amountCents;

        if (_amountCents > 0) {
            fiatBalancesCents[_userId] = safeAdd(fiatBalancesCents[_userId], uint(_amountCents));
        } else {
            fiatBalancesCents[_userId] = safeSub(fiatBalancesCents[_userId], uint(-_amountCents));
        }

        fiatTxCounts[_userId] = safeAdd(fiatTxCounts[_userId], 1);

        fiatTxTotal++;
        return c;
    }

    function getFiatTransactionsCount(string _userId) public constant returns (uint) {
        return fiatTxCounts[_userId];
    }

    function getAllFiatTransactionsCount() public constant returns (uint) {
        return fiatTxTotal;
    }

    function getFiatTransaction(string _userId, uint _index) public constant returns(int) {
        require(_index < fiatTxCounts[_userId]);
        return fiatTxs[_userId][_index];
    }

    function getUserFiatBalance(string _userId) public constant returns(uint) {
        return fiatBalancesCents[_userId];
    }

    function addGoldTransaction(string _userId, int _amount) public onlyController returns(uint) {
        require(0 != _amount);

        uint c = goldTxCounts[_userId];

        goldTxs[_userId][c] = _amount;

        if (_amount > 0) {
            goldHotBalances[_userId] = safeAdd(goldHotBalances[_userId], uint(_amount));
        } else {
            goldHotBalances[_userId] = safeSub(goldHotBalances[_userId], uint(-_amount));
        }

        goldTxCounts[_userId] = safeAdd(goldTxCounts[_userId], 1);

        goldTxTotal++;
        return c;
    }

    function getGoldTransactionsCount(string _userId) public constant returns (uint) {
        return goldTxCounts[_userId];
    }

    function getAllGoldTransactionsCount() public constant returns (uint) {
        return goldTxTotal;
    }

    function getGoldTransaction(string _userId, uint _index) public constant returns(int) {
        require(_index < goldTxCounts[_userId]);
        return goldTxs[_userId][_index];
    }

    function getUserHotGoldBalance(string _userId) public constant returns(uint) {
        return goldHotBalances[_userId];
    }

    function addBuyTokensRequest(address _who, string _userId, uint _reference, uint _amount) public onlyController returns(uint) {

        Request memory r;
        r.sender = _who;
        r.userId = _userId;
        r.reference = _reference;
        r.buyRequest = true;
        r.amount = _amount;
        r.state = 0;

        requests[requestsCount] = r;
        uint out = requestsCount;
        requestsCount++;
        return out;
    }

    function addSellTokensRequest(address _who, string _userId, uint _reference, uint _amount) public onlyController returns(uint) {
        Request memory r;
        r.sender = _who;
        r.userId = _userId;
        r.reference = _reference;
        r.buyRequest = false;
        r.amount = _amount;
        r.state = 0;

        requests[requestsCount] = r;
        uint out = requestsCount;
        requestsCount++;
        return out;
    }

    function getRequestsCount() public constant returns(uint) {
        return requestsCount;
    }

    function getRequest(uint _index) public constant returns(address, bytes32, uint, bool, uint8, uint) {
        require(_index < requestsCount);

        Request memory r = requests[_index];

        bytes32 userBytes = stringToBytes32(r.userId);

        return (r.sender, userBytes, r.reference, r.buyRequest, r.state, r.amount);
    }

    function cancelRequest(uint _index) onlyController public {
        require(_index < requestsCount);
        require(0==requests[_index].state);

        requests[_index].state = 2;
    }

    function setRequestFailed(uint _index) onlyController public {
        require(_index < requestsCount);
        require(0==requests[_index].state);

        requests[_index].state = 3;
    }

    function setRequestProcessed(uint _index) onlyController public {
        require(_index < requestsCount);
        require(0==requests[_index].state);

        requests[_index].state = 1;
    }
}

contract GoldIssueBurnFee is CreatorEnabled, StringMover {
    
    string gmUserId = "";

    // Functions:
    function GoldIssueBurnFee(string _gmUserId) public {
        creator = msg.sender;
        gmUserId = _gmUserId;
    }

    function getGoldmintFeeAccount() public constant returns(bytes32) {
        bytes32 userBytes = stringToBytes32(gmUserId);
        return userBytes;
    }

    function setGoldmintFeeAccount(string _gmUserId) public onlyCreator {
        gmUserId = _gmUserId;
    }

    function calculateIssueGoldFee(uint _mntpBalance, uint _value) public constant returns(uint) {
        return 0;
    }

    function calculateBurnGoldFee(uint _mntpBalance, uint _value) public constant returns(uint) {

        // If the sender holds 0 MNTP, then the transaction fee is 3%,
        // If the sender holds at least 10 MNTP, then the transaction fee is 2%,
        // If the sender holds at least 1000 MNTP, then the transaction fee is 1.5%,
        // If the sender holds at least 10000 MNTP, then the transaction fee is 1%,
        if (_mntpBalance >= (10000 * 1 ether)) {
             return (75 * _value / 10000);
        }

        if (_mntpBalance >= (1000 * 1 ether)) {
             return (15 * _value / 1000);
        }

        if (_mntpBalance >= (10 * 1 ether)) {
             return (25 * _value / 1000);
        }

        // 3%
        return (3 * _value / 100);
    }
}

contract IGoldIssueBurnFee {
    
    function getGoldmintFeeAccount()public constant returns(bytes32);
    function calculateIssueGoldFee(uint _mntpBalance, uint _goldValue) public constant returns(uint);
    function calculateBurnGoldFee(uint _mntpBalance, uint _goldValue) public constant returns(uint);
}

contract StorageController is SafeMath, CreatorEnabled, StringMover {
    
    Storage public stor;
    IMNTP public mntpToken;
    IGold public goldToken;
    IGoldIssueBurnFee public goldIssueBurnFee;

    address public managerAddress = 0x0;

    event TokenBuyRequest(address indexed _from, string indexed _userId, uint indexed _reference, uint _amount, uint _index);
    event TokenSellRequest(address indexed _from, string indexed _userId, uint indexed _reference, uint _amount, uint _index);
    event RequestCancelled(uint indexed _index);
    event RequestProcessed(uint indexed _index);
    event RequestFailed(uint indexed _index);

    modifier onlyManagerOrCreator() { require(msg.sender == managerAddress || msg.sender == creator); _; }

    function StorageController(address _mntpContractAddress, address _goldContractAddress, address _storageAddress, address _goldIssueBurnFeeContract) public {
        creator = msg.sender;

        if (0 != _storageAddress) {
             // use existing storage
             stor = Storage(_storageAddress);
        } else {
             stor = new Storage();
        }

        require(0x0!=_mntpContractAddress);
        require(0x0!=_goldContractAddress);
        require(0x0!=_goldIssueBurnFeeContract);

        mntpToken = IMNTP(_mntpContractAddress);
        goldToken = IGold(_goldContractAddress);
        goldIssueBurnFee = IGoldIssueBurnFee(_goldIssueBurnFeeContract);
    }

    function setManagerAddress(address _address) public onlyCreator {
       managerAddress = _address;
    }

    // Only old controller can call setControllerAddress
    function changeController(address _newController) public onlyCreator {
        stor.setControllerAddress(_newController);
    }

    function setHotWalletAddress(address _hotWalletAddress) public onlyCreator {
       stor.setHotWalletAddress(_hotWalletAddress);
    }

    function getHotWalletAddress() public constant returns (address) {
        return stor.hotWalletAddress();
    }

    function changeGoldIssueBurnFeeContract(address _goldIssueBurnFeeAddress) public onlyCreator {
        goldIssueBurnFee = IGoldIssueBurnFee(_goldIssueBurnFeeAddress);
    }

    function addDoc(string _ipfsDocLink) public onlyManagerOrCreator returns(uint) {
        return stor.addDoc(_ipfsDocLink);
    }

    function getDocCount() public constant returns (uint) {
        return stor.getDocCount();
    }

    function getDoc(uint _index) public constant returns (string) {
        bytes32 x;
        bytes32 y;
        (x, y) = stor.getDocAsBytes64(_index);
        return bytes64ToString(x,y);
    }


    // _amountCents can be negative
    // returns index in user array
    function addFiatTransaction(string _userId, int _amountCents) public onlyManagerOrCreator returns(uint) {
        return stor.addFiatTransaction(_userId, _amountCents);
    }

    function getFiatTransactionsCount(string _userId) public constant returns (uint) {
        return stor.getFiatTransactionsCount(_userId);
    }

    function getAllFiatTransactionsCount() public constant returns (uint) {
        return stor.getAllFiatTransactionsCount();
    }

    function getFiatTransaction(string _userId, uint _index) public constant returns(int) {
        return stor.getFiatTransaction(_userId, _index);
    }

    function getUserFiatBalance(string _userId) public constant returns(uint) {
        return stor.getUserFiatBalance(_userId);
    }

    function addGoldTransaction(string _userId, int _amount) public onlyManagerOrCreator returns(uint) {
        return stor.addGoldTransaction(_userId, _amount);
    }

    function getGoldTransactionsCount(string _userId) public constant returns (uint) {
        return stor.getGoldTransactionsCount(_userId);
    }

    function getAllGoldTransactionsCount() public constant returns (uint) {
        return stor.getAllGoldTransactionsCount();
    }

    function getGoldTransaction(string _userId, uint _index) public constant returns(int) {
        require(keccak256(_userId) != keccak256(""));

        return stor.getGoldTransaction(_userId, _index);
    }

    function getUserHotGoldBalance(string _userId) public constant returns(uint) {
        require(keccak256(_userId) != keccak256(""));

        return stor.getUserHotGoldBalance(_userId);
    }

    function addBuyTokensRequest(string _userId, uint _reference) public payable returns(uint) {
        require(keccak256(_userId) != keccak256(""));
        require(msg.value > 0);

        uint reqIndex = stor.addBuyTokensRequest(msg.sender, _userId, _reference, msg.value);
        
        TokenBuyRequest(msg.sender, _userId, _reference, msg.value, reqIndex);
        
        return reqIndex;
    }

    function addSellTokensRequest(string _userId, uint _reference, uint _amount) public returns(uint) {
        require(keccak256(_userId) != keccak256(""));
        require(_amount > 0);

        uint tokenBalance = goldToken.balanceOf(msg.sender);

        require(tokenBalance >= _amount);

        burnGoldTokens(msg.sender, _amount);

        uint reqIndex = stor.addSellTokensRequest(msg.sender, _userId, _reference, _amount);

        TokenSellRequest(msg.sender, _userId, _reference, _amount, reqIndex);

        return reqIndex;
    }

    function getRequestsCount() public constant returns(uint) {
        return stor.getRequestsCount();
    }

    function getRequest(uint _index) public constant returns(address, string, uint, bool, uint8, uint) {
        address sender;
        bytes32 userIdBytes;
        uint reference;
        bool buy;
        uint8 state;
        uint amount;
        
        (sender, userIdBytes, reference, buy, state, amount) = stor.getRequest(_index);

        string memory userId = bytes32ToString(userIdBytes);

        return (sender, userId, reference, buy, state, amount);
    }

    function cancelRequest(uint _index) onlyManagerOrCreator public {

        address sender;
        string memory userId;
        uint reference;
        bool isBuy;
        uint state;
        uint amount;
        (sender, userId, reference, isBuy, state, amount) = getRequest(_index);
        require(0 == state);

        if (isBuy) {
            sender.transfer(amount);
        } else {
            goldToken.issueTokens(sender, amount);
        }

        stor.cancelRequest(_index);

        RequestCancelled(_index);
    }

    function processRequest(uint _index, uint _ethPerGold) onlyManagerOrCreator public {
        require(_index < getRequestsCount());

        address sender;
        string memory userId;
        uint reference;
        bool isBuy;
        uint state;
        uint amount;
        (sender, userId, reference, isBuy, state, amount) = getRequest(_index);
        require(0 == state);

        bool processResult = true;

        if (isBuy) {
            processResult = processBuyRequest(userId, sender, amount, _ethPerGold);
        } else {
            processResult = processSellRequest(userId, sender, amount, _ethPerGold);
        }

        return;

        if (processResult) {
            stor.setRequestProcessed(_index);
            RequestProcessed(_index);
        } else {
            stor.setRequestFailed(_index);
            RequestFailed(_index);
        }

    }

    function processBuyRequest(string _userId, address _userAddress, uint _amountWei, uint _ethPerGold) internal returns(bool) {
        require(keccak256(_userId) != keccak256(""));

        uint userMntpBalance = mntpToken.balanceOf(_userAddress);
        uint fee = goldIssueBurnFee.calculateIssueGoldFee(userMntpBalance, _amountWei);
        require(_amountWei > fee);
        
        // issue tokens minus fee
        uint amountWeiMinusFee = _amountWei;
        if (fee > 0) {
            amountWeiMinusFee = safeSub(_amountWei, fee);
        }

        require(amountWeiMinusFee > 0);
        
        uint tokens = uint(amountWeiMinusFee) / _ethPerGold;
        issueGoldTokens(_userAddress, tokens);
        
        // request from hot wallet
        if (isHotWallet(_userAddress)) {
            addGoldTransaction(_userId, int(tokens));
        }

        return true;
    }

    function processSellRequest(string _userId, address _userAddress, uint _amountToken, uint _ethPerGold) internal returns(bool) {
        require(keccak256(_userId) != keccak256(""));

        uint amountWei = safeMul(_amountToken, _ethPerGold);

        require(amountWei > 0);
        // request from hot wallet
        if (isHotWallet(_userAddress)) {
            // TODO: overflow
            addGoldTransaction(_userId, - int(_amountToken));
        }
        
        // fee
        uint userMntpBalance = mntpToken.balanceOf(_userAddress);
        uint fee = goldIssueBurnFee.calculateBurnGoldFee(userMntpBalance, amountWei);
        
        require(amountWei > fee);
        
        uint amountWeiMinusFee = amountWei;

        if (fee > 0) {
             amountWeiMinusFee = safeSub(amountWei, fee);
        }

        require(amountWeiMinusFee > 0);

        if (amountWeiMinusFee > this.balance) {
            issueGoldTokens(_userAddress, _amountToken);
            return false;
        }

        _userAddress.transfer(amountWeiMinusFee);

        return true;
    }

    //////// INTERNAL REQUESTS FROM HOT WALLET
    function processInternalRequest(string _userId, bool _isBuy, uint _amountCents, uint _centsPerGold) onlyManagerOrCreator public {
      if (_isBuy) {
          processBuyRequest(_userId, getHotWalletAddress(), _amountCents, _centsPerGold);
      } else {
          processSellRequest(_userId, getHotWalletAddress(), _amountCents, _centsPerGold);
      }
    }

    function transferGoldFromHotWallet(address _to, uint _value, string _userId) onlyManagerOrCreator public {
      require(keccak256(_userId) != keccak256(""));

      uint balance = getUserHotGoldBalance(_userId);
      require(balance >= _value);

      goldToken.burnTokens(getHotWalletAddress(), _value);
      goldToken.issueTokens(_to, _value);

      addGoldTransaction(_userId, -int(_value));
    }


    function withdrawEth(address _userAddress, uint _value) onlyManagerOrCreator public {
        require(_value >= 0.1 * 1 ether);
        
        if (this.balance < _value) _value = this.balance;
        
        _userAddress.transfer(this.balance);
    }
    
    function withdrawTokens(address _userAddress, uint _value) onlyManagerOrCreator public {
        burnGoldTokens(address(this), _value);
        
        issueGoldTokens(_userAddress, _value);
    }

    ////////
    function issueGoldTokens(address _userAddress, uint _tokenAmount) internal {
        require(0!=_tokenAmount);
        goldToken.issueTokens(_userAddress, _tokenAmount);
    }

    function burnGoldTokens(address _userAddress, uint _tokenAmount) internal {
        require(0!=_tokenAmount);
        goldToken.burnTokens(_userAddress, _tokenAmount);
    }

    function isHotWallet(address _address) internal returns(bool) {
       return _address == getHotWalletAddress();
    }
}