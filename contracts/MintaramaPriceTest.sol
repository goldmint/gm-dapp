pragma solidity ^0.4.18;

contract MintaramaPriceTest {

    int128 _tokenPrice;
    int40 internal _priceSpeedPercent = 5;
    int40 internal _priceSpeedTokenBlock = 10000;

    function MintaramaPriceTest() public {
        _tokenPrice = RealMath.toReal(1);
    }

    function updatePrice(int40 tokenAmount) public {
        _tokenPrice = RealMath.mul(_tokenPrice, tokenExp(tokenAmount));
    }

    function tokenExp(int40 tokenAmount) public view returns(int128) {
        int128 realTokenAmount = RealMath.toReal(tokenAmount);
        int128 realPercent = RealMath.div(RealMath.toReal(_priceSpeedPercent), RealMath.toReal(100));
        int128 realSpeed = RealMath.div(realPercent, RealMath.toReal(_priceSpeedTokenBlock));
        int128 expArg = RealMath.mul(realTokenAmount, realSpeed);
        return RealMath.exp(expArg);
    }

    function getPrice() public view returns(int128) {
        return (_tokenPrice);
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

