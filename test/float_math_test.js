var solc = require('solc');
var Web3 = require('web3');
var expect = require('chai').expect;

var fs = require('fs');
var assert = require('assert');
var BigNumber = require('bignumber.js');
var realMath = require('./helpers/real_math.js');

var web3 = new Web3(new Web3.providers.HttpProvider(process.env.ETH_NODE));

var accounts;
var creator;

var mptContractAddress;
var mptContract;


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

          deployMintaramaPriceTestContract(data,function(err){
               assert.equal(err,null);
               done();
          });

    });

    it('test eth-tokens converter', async() => {

        var eth = await mptContract.realTokensToRealEth(realMath.toReal(100));

        var tok = realMath.fromReal(await mptContract.realEthToRealTokens(eth));

        console.log("tok: " +  tok);

    });
    it('test convert', async() => {
        
        var val = 0.22243 * 1e18;


        var valReal = await mptContract.convertUint256ToReal(val);
        var val256 =  await mptContract.convertRealToUint256(valReal);
        var negValReal = await mptContract.convertInt256ToReal(-val);

        console.log(toFixed(val));
        console.log(toFixed(realMath.fromReal(valReal) * 1e18));
        console.log(val256.toString(10));

        console.log(toFixed(valReal));
        console.log(toFixed(negValReal));
        //console.log(toFixed(realMath.fromReal(negValReal) * 1e18));
        //console.log(toFixed(realMath.fromReal(-Math.abs(valReal)) * 1e18));

        assert.equal(toFixed(val), toFixed(realMath.fromReal(valReal) * 1e18));
        assert.equal(toFixed(val), val256.toString(10));
        //assert.equal(toFixed(realMath.fromReal(negValReal)), toFixed(realMath.fromReal(-valReal)));

    });

//return;
    it('should check token price calculations', async() => {
        
        var priceSpeed = 0.05 / 10000;

        var expectedTokenPrice = 1;
        var totalTokenBalance = 0;
        var startPrice = 0.01;

        for (var dealNum = 0; dealNum < 10000; dealNum++) {
            var tokenAmount = getRandomInt(-1000, 1000);
            if (tokenAmount == 0) continue;
            totalTokenBalance += tokenAmount;
            
            expectedTokenPrice = startPrice * Math.exp(totalTokenBalance * priceSpeed);

            await mptContract.updatePrice(tokenAmount, { from: buyer1 });

            var realTokenPrice = realMath.fromReal(await mptContract.getPrice());

            var realTokensToRealEth = realMath.fromReal(await mptContract.realTokensToRealEth(realMath.toReal(tokenAmount)));
            var realTokensToEth = (await mptContract.realTokensToEth(realMath.toReal(tokenAmount))) / 1e18;

            var realEthToRealTokens = realMath.fromReal(await mptContract.realEthToRealTokens(realMath.toReal(realTokensToRealEth)));
            var realEthToTokens = (await mptContract.realEthToTokens(realMath.toReal(realTokensToRealEth))) / 1e18;


            console.log("realTokensToRealEth: " + realTokensToRealEth + "; realTokensToEth: " + realTokensToEth + "; realEthToRealTokens: " + realEthToRealTokens + "; realEthToTokens: " + realEthToTokens);

            console.log("dealNum: " + (dealNum + 1) + "; tokenAmount: " + tokenAmount + "; expected token price: " + expectedTokenPrice + "; realTokenPrice: " + realTokenPrice + "; token balance: " + totalTokenBalance);

            assert(Math.abs(expectedTokenPrice - realTokenPrice) <= 1E-12,  "DealNum=" + dealNum + ". Token price should be ~= " + expectedTokenPrice + "; realTokenPrice=" + realTokenPrice);
        }

    });

});

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function toFixed(x) {
    if (Math.abs(x) < 1.0) {
      var e = parseInt(x.toString().split('e-')[1]);
      if (e) {
          x *= Math.pow(10,e-1);
          x = '0.' + (new Array(e)).join('0') + x.toString().substring(2);
      }
    } else {
      var e = parseInt(x.toString().split('+')[1]);
      if (e > 20) {
          e -= 20;
          x /= Math.pow(10,e);
          x += (new Array(e+1)).join('0');
      }
    }
    return x;
  }