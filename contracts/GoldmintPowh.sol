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

    uint128 constant internal BIG_PROMO_BLOCK_INTERVAL = 9999;
    uint128 constant internal QUICK_PROMO_BLOCK_INTERVAL = 100;
    uint128 constant internal PROMO_MIN_PURCHASE = 100;



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
    mapping(address => uint256) internal _promoBonuses;
    mapping(address => uint256) internal _ambassadorAccumulatedQuota;    

    mapping(bytes32 => bool) public _administrators;
    
    uint256 internal _totalSupply;

    uint256 internal _initBlockNum;
    uint256 internal _bonusPerMntp;
    uint256 internal _devReward;
    uint256 internal _bigPromoBonus;
    uint256 internal _quickPromoBonus;
    
    
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
        _initBlockNum = block.number;
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
     * If `includeRefBonus` is to to 1/true, the referral bonus will be included in the calculations.
     * The reason for this, is that in the frontend, we will want to get the total divs (global + ref)
     * But in the internal calculations, we want them separate. 
     */ 
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

    function getBlockNum() public view returns(uint256) {
        return block.number;
    }

    uint256 _testInc = 0;
    function nextBlock() public {
        _testInc++;
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
        
        checkAndSendPromoBonus(tokenAmount);

        onTokenPurchase(msg.sender, ethAmount, tokenAmount, refAddress);
        
        return tokenAmount;
    }

    function checkAndSendPromoBonus(uint256 purchaedTokenAmount) internal {
        if (purchaedTokenAmount < PROMO_MIN_PURCHASE) return;

        if ((block.number - _initBlockNum) % QUICK_PROMO_BLOCK_INTERVAL == 0) sendQuickPromoBonus();
        if ((block.number - _initBlockNum) % BIG_PROMO_BLOCK_INTERVAL == 0) sendBigPromoBonus();
    }

    function sendQuickPromoBonus() internal {
        _promoBonuses[msg.sender] = SafeMath.add(_promoBonuses[msg.sender], _quickPromoBonus);
        _quickPromoBonus = 0;
    }


    function sendBigPromoBonus() internal {
        _promoBonuses[msg.sender] = SafeMath.add(_promoBonuses[msg.sender], _bigPromoBonus);
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

library RealMath {
    
    /**
     * This lib is taken from https://github.com/NovakDistributed/macroverse/blob/master/contracts/RealMath.sol and a bit modified
     */

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
        if (real_value < 0) {
            // Add the negative sign back in.
            return -fractional;
        } else {
            return fractional;
        }
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
}

