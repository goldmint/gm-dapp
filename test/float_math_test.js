var solc = require('solc');
var Web3 = require('web3');
var expect = require('chai').expect;

var fs = require('fs');
var assert = require('assert');
var BigNumber = require('bignumber.js');
var realMath = require('./helpers/real-math.js');

var web3 = new Web3(new Web3.providers.HttpProvider(process.env.ETH_NODE));

var accounts;
var creator;

var floatMathContractAddress;
var floatMathContract;


eval(fs.readFileSync('./test/helpers/misc.js')+'');

describe('FLOAT_MATH', function() {

    before("Initialize everything", function(done) {
          web3.eth.getAccounts(function(err, as) {
               if(err) {
                    done(err);
                    return;
               }

               accounts = as;
               creator = accounts[0];
               buyer1 = accounts[1];
               buyer2 = accounts[2];
               buyer3 = accounts[3];
               goldmintTeamAddress = accounts[4];
               buyer4 = accounts[5];
               hotWalletTokenHolderAddress = accounts[6];

               done();
          });
    });

    after("Deinitialize everything", function(done) {
          done();
    });    

    it('should deploy contract', function(done) {
          var data = {};

          deployFloatMathContract(data,function(err){
               assert.equal(err,null);
               done();
          });

    });


    it('should check token price calculations', async() =>{
        
        var priceSpeed = 0.05;
        var tokenPriceBlock = 10000;
        var expectedTokenPrice = 1;

        for (var dealNum = 0; dealNum < 10000; dealNum++) {
            var tokenAmount = getRandomInt(-1000, 1000);
            if (tokenAmount == 0) continue;

            var exp = (tokenAmount > 0 ? 1 : -1) * tokenAmount * priceSpeed/tokenPriceBlock

            expectedTokenPrice = expectedTokenPrice * Math.exp(exp);

            await floatMathContract.updatePrice(realMath.toReal(exp), { from: buyer1 });
            
            var realTokenPrice = realMath.fromReal(await floatMathContract.getPrice());

            console.log("dealNum: " + (dealNum + 1) + "; tokenAmount: " + tokenAmount + "; expected token price: " + expectedTokenPrice + "; realTokenPrice: " + realTokenPrice);

            assert(Math.abs(expectedTokenPrice - realTokenPrice) <= 1E-12,  "token price of DealNum=" + dealNum + " should be approximately equal " + expectedTokenPrice + "; realTokenPrice=" + realTokenPrice);
        }

    });

return;
  it("should compute exp", async function() {
    
    for(let val of [-10, -Math.PI, -1, -0.1, 0, 0.1, 0.2, 0.9, 1.0, 1.1, 1.5, 2.0, 3.0, 3.67, Math.PI, Math.E]) {

  
      let result = realMath.fromReal(await floatMathContract.exp(realMath.toReal(val)))
        console.log("exp of " + val + ": " + result);

      // Make sure we get the right answer        
      //assert.approximately(result, Math.exp(val), 1E-6, "exp of " + val + " should be approximately right")
    }
    
    // TODO: Test larger values (with less accuracy required?)
    // TODO: Make more accurate?
    
  })

});

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}