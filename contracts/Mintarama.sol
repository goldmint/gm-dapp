pragma solidity ^0.4.18;

contract Mintarama {

    IMNTP _mntpToken;

    uint256 constant internal MAGNITUDE = 2**64;

    uint8 constant public TOTAL_FEE_PERCENT = 10;

    uint8 constant public DEV_REWARD_PERCENT = 40;
    uint8 constant public MNTP_REWARD_PERCENT = 30;
    uint8 constant public REF_BONUS_PERCENT = 20;
    uint8 constant public BIG_PROMO_PERCENT = 5;
    uint8 constant public QUICK_PROMO_PERCENT = 5;

    uint128 public BIG_PROMO_BLOCK_INTERVAL = 9999;
    uint128 public QUICK_PROMO_BLOCK_INTERVAL = 100;
    uint256 public PROMO_MIN_PURCHASE = 100 ether;

    int40 constant public PRICE_SPEED_PERCENT = 5;
    int40 constant public PRICE_SPEED_TOKEN_BLOCK = 10000;


    uint256 constant public TOKEN_PRICE_INITIAL = 0.01 ether;
    uint256 constant public TOKEN_PRICE_INC = 0.00000001 ether;
    uint256 constant public MIN_REF_TOKEN_AMOUNT = 1 ether;

    
    // ambassador program
    mapping(address => bool) internal _ambassadors;
    uint256 constant internal _ambassadorMaxPurchase = 1 ether;
    uint256 constant internal _ambassadorQuota = 20 ether;


    mapping(address => uint256) internal _userTokenBalances;
    mapping(address => uint256) internal _referralBalances;
    mapping(address => uint256) internal _rewardPayouts;
    mapping(address => uint256) internal _promoBonuses;
    mapping(address => uint256) internal _ambassadorAccumulatedQuota;    

    mapping(bytes32 => bool) public _administrators;
    
    uint256 internal _totalSupply;
    int128 internal _realTokenPrice;

    uint256 internal _initBlockNum;
    uint256 internal _bonusPerMntp;
    uint256 internal _devReward;
    uint256 internal _bigPromoBonus;
    uint256 internal _quickPromoBonus;
    
    
    event onTokenPurchase(address indexed userAddress, uint256 incomingEth, uint256 tokensMinted, address indexed referredBy);
    
    event onTokenSell(address indexed userAddress, uint256 tokensBurned, uint256 ethEarned);
    
    event onReinvestment(address indexed userAddress, uint256 ethReinvested, uint256 tokensMinted);
    
    event onWithdraw(address indexed userAddress, uint256 ethWithdrawn); 

    event onWinQuickPromo(address indexed userAddress, uint256 ethWon);    
   
    event onWinBigPromo(address indexed userAddress, uint256 ethWon);    


    // only people with tokens
    modifier onlyContractUsers() {
        require(getLocalTokenBalance(msg.sender) > 0);
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


    function Mintarama(address mntpTokenAddress) public {
        _mntpToken = IMNTP(mntpTokenAddress);
        _administrators[keccak256(msg.sender)] = true;
        _initBlockNum = block.number;
        _realTokenPrice = convert256ToReal(TOKEN_PRICE_INITIAL);
    }
    
    function setTotalSupply(uint256 totalTokenAmount) public onlyAdministrator {
        uint256 tokenAmount = _mntpToken.balanceOf(address(this));
        
        require(_totalSupply == 0 && tokenAmount == totalTokenAmount);

        _totalSupply = totalTokenAmount;
    }

    function setBigPromoInterval(uint128 val) public onlyAdministrator {
        BIG_PROMO_BLOCK_INTERVAL = val;
    }

    function setQuickPromoInterval(uint128 val) public onlyAdministrator {
        QUICK_PROMO_BLOCK_INTERVAL = val;
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
        
        // add ref bonus
        reward = SafeMath.add(reward, _referralBalances[msg.sender]);
        _referralBalances[msg.sender] = 0;

        // add promo bonus
        reward = SafeMath.add(reward, _promoBonuses[msg.sender]);
        _promoBonuses[msg.sender] = 0;
        
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
        
        updateTokenPrice(-convert256ToReal(tokenAmount));
        
        onTokenSell(msg.sender, tokenAmount, taxedEth);

        return taxedEth;
    }   

    /* HELPERS */  

    function getCurrentTokenPrice() public view returns(uint256) {
        return convertRealTo256(_realTokenPrice);
    }

    function getRealCurrentTokenPrice() public view returns(int128) {
        return _realTokenPrice;
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

    function getLocalTokenBalance(address userAddress) public view returns(uint256) {
        return _userTokenBalances[userAddress];
    }
    
    function getCurrentUserTokenBalance() public view returns(uint256) {
        return getLocalTokenBalance(msg.sender);
    }    


    function getUserReward(bool includeRefBonus) public view returns(uint256) {
        uint256 reward = _bonusPerMntp * _userTokenBalances[msg.sender];
        reward = ((reward < _rewardPayouts[msg.sender]) ? 0 : SafeMath.sub(reward, _rewardPayouts[msg.sender])) / MAGNITUDE;
        
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
        uint256 tokenAmount = realEthToTokens(convert256ToReal(taxedEth));

        return (tokenAmount, totalFeeEth, taxedEth);
    }
    

    function estimateSellOrder(uint256 tokenAmount) public view returns(uint256, uint256, uint256) {
        uint256 ethAmount = tokensToEth(convert256ToReal(tokenAmount));
        uint256 totalFeeEth = calcTotalFee(ethAmount);
        uint256 taxedEth = SafeMath.sub(ethAmount, totalFeeEth);

        return (taxedEth, ethAmount, totalFeeEth);
    }

    function getUserMaxPurchase(address userAddress) public view returns(uint256) {
        return _mntpToken.balanceOf(userAddress) - getLocalTokenBalance(userAddress);
    }
    
    function getCurrentUserMaxPurchase() public view returns(uint256) {
        return getUserMaxPurchase(msg.sender);
    }

    function getDevReward() public view returns(uint256) {
        return _devReward;
    }

    function getPromoBonus() public view returns(uint256) {
        return _promoBonuses[msg.sender];
    }

    function getRealPriceSpeed() public view returns(int128) {
        int128 realPercent = RealMath.div(RealMath.toReal(PRICE_SPEED_PERCENT), RealMath.toReal(100));
        return RealMath.div(realPercent, RealMath.toReal(PRICE_SPEED_TOKEN_BLOCK));
    }
   
    function getBlockNum() public view returns(uint256) {
        return block.number;
    }

    function getInitBlockNum() public view returns(uint256) {
        return _initBlockNum;
    }

    // INTERNAL FUNCTIONS

    
    function purchaseTokens(uint256 ethAmount, address refAddress) internal returns(uint256) {

        uint256 tokenAmount = 0; uint256 totalFeeEth = 0; uint256 taxedEth = 0;
        (tokenAmount, totalFeeEth, taxedEth) = estimateBuyOrder(ethAmount);

        //user has to have at least equal amount of tokens which he's willing to buy 
        require(getCurrentUserMaxPurchase() >= tokenAmount);

        require(tokenAmount > 0 && (SafeMath.add(tokenAmount, getTotalTokenSold()) > getTotalTokenSold()));

        if (refAddress == msg.sender || getLocalTokenBalance(refAddress) < MIN_REF_TOKEN_AMOUNT) refAddress = 0x0;

        uint256 userRewardBefore = getUserReward(false);

        distributeFee(totalFeeEth, refAddress);
        
        addUserTokens(msg.sender, tokenAmount);

        // the user is not going to receive any reward for the current purchase
        _rewardPayouts[msg.sender] = SafeMath.add(_rewardPayouts[msg.sender], SafeMath.sub(getUserReward(false), userRewardBefore) * MAGNITUDE);
        
        checkAndSendPromoBonus(tokenAmount);
        
        updateTokenPrice(convert256ToReal(tokenAmount));
        
        onTokenPurchase(msg.sender, ethAmount, tokenAmount, refAddress);
        
        return tokenAmount;
    }


    function checkAndSendPromoBonus(uint256 purchaedTokenAmount) internal {
        if (purchaedTokenAmount < PROMO_MIN_PURCHASE) return;

        uint256 blockNumSinceInit = block.number - _initBlockNum;

        if (blockNumSinceInit % QUICK_PROMO_BLOCK_INTERVAL == 0) sendQuickPromoBonus();
        if (blockNumSinceInit % BIG_PROMO_BLOCK_INTERVAL == 0) sendBigPromoBonus();
    }



    function sendQuickPromoBonus() internal {
        _promoBonuses[msg.sender] = SafeMath.add(_promoBonuses[msg.sender], _quickPromoBonus);
        
        onWinQuickPromo(msg.sender, _quickPromoBonus);

        _quickPromoBonus = 0;
    }


    function sendBigPromoBonus() internal {
        _promoBonuses[msg.sender] = SafeMath.add(_promoBonuses[msg.sender], _bigPromoBonus);

        onWinBigPromo(msg.sender, _bigPromoBonus);

        _bigPromoBonus = 0;        
    }

    function distributeFee(uint256 totalFeeEth, address refAddress) internal {

        addProfitPerShare(totalFeeEth, refAddress);
        addDevReward(totalFeeEth);
        addBigPromoBonus(totalFeeEth);
        addQuickPromoBonus(totalFeeEth);
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

    function addBigPromoBonus(uint256 totalFeeEth) internal {
        _bigPromoBonus = SafeMath.add(_bigPromoBonus, calcBigPromoBonus(totalFeeEth));
    }

    function addQuickPromoBonus(uint256 totalFeeEth) internal {
        _quickPromoBonus = SafeMath.add(_quickPromoBonus, calcQuickPromoBonus(totalFeeEth));
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

    function updateTokenPrice(int128 realTokenAmount) internal {
        _realTokenPrice = calc1RealTokenRateFromRealTokens(realTokenAmount);
    }

    function realEthToTokens(int128 realEthAmount) internal view returns(uint256) {

        int128 t0 = RealMath.div(realEthAmount, _realTokenPrice);
        int128 s = RealMath.div(getRealPriceSpeed(), RealMath.toReal(2));
        int128 tns = RealMath.mul(t0, s);
        int128 exptns = RealMath.exp(tns);

        int128 tn0 = t0;

        for (uint i = 0; i < 10; i++) {

            int128 tn1 = RealMath.div(
                RealMath.mul( RealMath.mul(RealMath.ipow(t0, 2), s), exptns ) + t0,
                RealMath.mul( exptns, RealMath.toReal(1) + tns )
            );

            if (RealMath.abs(tn0-tn1) < RealMath.div(RealMath.toReal(1), RealMath.toReal(10e10))) break;

            tn0 = tn1;
        }


        return convertRealTo256(tn0);
    }

    function tokensToEth(int128 realTokenAmount) internal view returns(uint256) {
        return convertRealTo256(RealMath.mul(realTokenAmount, calc1RealTokenRateFromRealTokens(realTokenAmount)));
    }

    function calc1RealTokenRateFromRealTokens(int128 realTokenAmount) internal view returns(int128) {
        int128 expArg = RealMath.mul(realTokenAmount, getRealPriceSpeed());

        return RealMath.mul(_realTokenPrice, RealMath.exp(expArg));
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

    /*
    * Converts real num to uint256. Works only with positive numbers. Occurancy is 5 fractional digits.
    */

    function convertRealTo256(int128 realVal) internal pure returns(uint256){
        return SafeMath.mul(uint256(RealMath.fromReal(RealMath.round(RealMath.mul(realVal, RealMath.toReal(1e5))))), uint(1e13));
    }

    /*
    * Converts uint256 to real num. Occurancy is 5 fractional digits.
    */
    function convert256ToReal(uint256 val) internal pure returns(int128) {
        return RealMath.div(RealMath.toReal(int40(SafeMath.div(val, 1e13))), RealMath.toReal(int40(1e5)));
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

    function mul(uint128 a, uint128 b) internal pure returns (uint128) {
        if (a == 0) {
            return 0;
        }
        uint128 c = a * b;
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

    function div(uint128 a, uint128 b) internal pure returns (uint128) {
        // assert(b > 0); // Solidity automatically throws when dividing by 0
        uint128 c = a / b;
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

    function sub(uint128 a, uint128 b) internal pure returns (uint128) {
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

    function add(uint128 a, uint128 b) internal pure returns (uint128) {
        uint128 c = a + b;
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


library RealMath {
    
    /**
     * How many total bits are there?
     */
    int256 constant REAL_BITS = 128;
    
    /**
     * How many fractional bits are there?
     */
    int256 constant REAL_FBITS = 88;
    
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
    function toReal(int40 ipart) internal pure returns (int128) {
        return int128(ipart) * REAL_ONE;
    }
    
    /**
     * Convert a real to an integer. Preserves sign.
     */
    function fromReal(int128 real_value) internal pure returns (int40) {
        return int40(real_value / REAL_ONE);
    }
    
    /**
     * Round a real to the nearest integral real value.
     */
    function round(int128 real_value) internal pure returns (int128) {
        // First, truncate.
        int40 ipart = fromReal(real_value);
        if ((fractionalBits(real_value) & (uint88(1) << (REAL_FBITS - 1))) > 0) {
            // High fractional bit is set. Round up.
            if (real_value < int128(0)) {
                // Rounding up for a negative number is rounding down.
                ipart -= 1;
            } else {
                ipart += 1;
            }
        }
        return toReal(ipart);
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
     * Returns the fractional bits of a real. Ignores the sign of the real.
     */
    function fractionalBits(int128 real_value) internal pure returns (uint88) {
        return uint88(abs(real_value) % REAL_ONE);
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
    function fraction(int40 numerator, int40 denominator) internal pure returns (int128) {
        return div(toReal(numerator), toReal(denominator));
    }
    
    // Now we have some fancy math things (like pow and trig stuff). This isn't
    // in the RealMath that was deployed with the original Macroverse
    // deployment, so it needs to be linked into your contract statically.
    
    /**
     * Raise a number to a positive integer power in O(log power) time.
     * See <https://stackoverflow.com/a/101613>
     */
    function ipow(int128 real_base, int40 exponent) internal pure returns (int128) {
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
    function rescale(int128 real_arg) internal pure returns (int128 real_scaled, int40 shift) {
        if (real_arg <= 0) {
            // Not in domain!
            revert();
        }
        
        // Find the high bit
        int40 high_bit = findbit(hibit(uint256(real_arg)));
        
        // We'll shift so the high bit is the lowest non-fractional bit.
        shift = high_bit - int40(REAL_FBITS);
        
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
        int40 shift;
        (real_rescaled, shift) = rescale(real_arg);
        
        // Compute the argument to iterate on
        int128 real_series_arg = div(real_rescaled - REAL_ONE, real_rescaled + REAL_ONE);
        
        // We will accumulate the result here
        int128 real_series_result = 0;
        
        for (int40 n = 0; n < max_iterations; n++) {
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
        
        for (int40 n = 0; n < max_iterations; n++) {
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
    
    /**
     * Compute the sin of a number to a certain number of Taylor series terms.
     */
    function sinLimited(int128 real_arg, int40 max_iterations) internal pure returns (int128) {
        // First bring the number into 0 to 2 pi
        // TODO: This will introduce an error for very large numbers, because the error in our Pi will compound.
        // But for actual reasonable angle values we should be fine.
        real_arg = real_arg % REAL_TWO_PI;
        
        int128 accumulator = REAL_ONE;
        
        // We sum from large to small iteration so that we can have higher powers in later terms
        for (int40 iteration = max_iterations - 1; iteration >= 0; iteration--) {
            accumulator = REAL_ONE - mul(div(mul(real_arg, real_arg), toReal((2 * iteration + 2) * (2 * iteration + 3))), accumulator);
            // We can't stop early; we need to make it to the first term.
        }
        
        return mul(real_arg, accumulator);
    }
    
    /**
     * Calculate sin(x) with a sensible maximum iteration count to wait until
     * convergence.
     */
    function sin(int128 real_arg) internal pure returns (int128) {
        return sinLimited(real_arg, 15);
    }
    
    /**
     * Calculate cos(x).
     */
    function cos(int128 real_arg) internal pure returns (int128) {
        return sin(real_arg + REAL_HALF_PI);
    }
    
    /**
     * Calculate tan(x). May overflow for large results. May throw if tan(x)
     * would be infinite, or return an approximation, or overflow.
     */
    function tan(int128 real_arg) internal pure returns (int128) {
        return div(sin(real_arg), cos(real_arg));
    }
    
    /**
     * Calculate atan(x) for x in [-1, 1].
     * Uses the Chebyshev polynomial approach presented at
     * https://www.mathworks.com/help/fixedpoint/examples/calculate-fixed-point-arctangent.html
     * Uses polynomials received by personal communication.
     * 0.999974x-0.332568x^3+0.193235x^5-0.115729x^7+0.0519505x^9-0.0114658x^11
     */
    function atanSmall(int128 real_arg) internal pure returns (int128) {
        int128 real_arg_squared = mul(real_arg, real_arg);
        return mul(mul(mul(mul(mul(mul(
            - 12606780422,  real_arg_squared) // x^11
            + 57120178819,  real_arg_squared) // x^9
            - 127245381171, real_arg_squared) // x^7
            + 212464129393, real_arg_squared) // x^5
            - 365662383026, real_arg_squared) // x^3
            + 1099483040474, real_arg);       // x^1
    }
    
    /**
     * Compute the nice two-component arctangent of y/x.
     */
    function atan2(int128 real_y, int128 real_x) internal pure returns (int128) {
        int128 atan_result;
        
        // Do the angle correction shown at
        // https://www.mathworks.com/help/fixedpoint/examples/calculate-fixed-point-arctangent.html
        
        // We will re-use these absolute values
        int128 real_abs_x = abs(real_x);
        int128 real_abs_y = abs(real_y);
        
        if (real_abs_x > real_abs_y) {
            // We are in the (0, pi/4] region
            // abs(y)/abs(x) will be in 0 to 1.
            atan_result = atanSmall(div(real_abs_y, real_abs_x));
        } else {
            // We are in the (pi/4, pi/2) region
            // abs(x) / abs(y) will be in 0 to 1; we swap the arguments
            atan_result = REAL_HALF_PI - atanSmall(div(real_abs_x, real_abs_y));
        }
        
        // Now we correct the result for other regions
        if (real_x < 0) {
            if (real_y < 0) {
                atan_result -= REAL_PI;
            } else {
                atan_result = REAL_PI - atan_result;
            }
        } else {
            if (real_y < 0) {
                atan_result = -atan_result;
            }
        }
        
        return atan_result;
    }    
}

