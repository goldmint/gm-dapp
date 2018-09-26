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


    it('should check token price calculations', async() => {
        
        var priceSpeed = 0.05 / 20000;

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
            var realTokensToEth = (await mptContract.realTokensToEth(realMath.toReal(tokenAmount))) / 10e18;

            var realEthToRealTokens = realMath.fromReal(await mptContract.realEthToRealTokens(realMath.toReal(realTokensToRealEth)));
            var realEthToTokens = (await mptContract.realEthToTokens(realMath.toReal(realTokensToRealEth))) / 10e18;


            console.log("realTokensToRealEth: " + realTokensToRealEth + "; realTokensToEth: " + realTokensToEth + "; realEthToRealTokens: " + realEthToRealTokens + "; realEthToTokens: " + realEthToTokens);

            console.log("dealNum: " + (dealNum + 1) + "; tokenAmount: " + tokenAmount + "; expected token price: " + expectedTokenPrice + "; realTokenPrice: " + realTokenPrice + "; token balance: " + totalTokenBalance);

            assert(Math.abs(expectedTokenPrice - realTokenPrice) <= 1E-12,  "DealNum=" + dealNum + ". Token price should be ~= " + expectedTokenPrice + "; realTokenPrice=" + realTokenPrice);
        }

    });

});

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}