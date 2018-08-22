var solc = require('solc');
var Web3 = require('web3');

var fs = require('fs');
var assert = require('assert');
var BigNumber = require('bignumber.js');

var web3 = new Web3(new Web3.providers.HttpProvider(process.env.ETH_NODE));

var accounts;
var creator;
var buyer;
var buyer2;
var buyer3;
var buyer4;


var mntContractAddress;
var mntContract;

var powhContractAddress;
var powhContract;

var ether = 1000000000000000000;

eval(fs.readFileSync('./test/helpers/misc.js')+'');

describe('POWH', function() {

     before("Initialize everything", function(done) {
          web3.eth.getAccounts(function(err, as) {
               if(err) {
                    done(err);
                    return;
               }

               accounts = as;
               creator = accounts[0];
               buyer = accounts[1];
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

     it('should deploy token contract',function(done){
          var data = {};

          deployMntContract(data,function(err){
               assert.equal(err,null);
               
                deployGoldmintPowhContract(data,function(err){
                    assert.equal(err,null);

                    done();
                });
          });

     });

     it('should issue some MNTP',function(done){

        var powhContractTokenAmount = 2000000*ether;

        mntContract.issueTokens(powhContractAddress, powhContractTokenAmount, { from: creator, gas: 2900000 }, function(err, res) {
            assert.equal(err,null);

            assert.equal(powhContractTokenAmount, mntContract.balanceOf(powhContractAddress));
        });

        var byerTokenAmount = 1000*ether;

        mntContract.issueTokens(buyer2, byerTokenAmount, { from: creator, gas: 2900000 }, function(err, res) {
            assert.equal(err,null);

            assert.equal(byerTokenAmount, mntContract.balanceOf(buyer2));

            powhContract.getCurrentUserMaxPurchase({ from: buyer2, gas: 2900000 }, function(err, res) {
                assert.equal(byerTokenAmount, res);
            });
        });


        mntContract.issueTokens(buyer, byerTokenAmount, { from: creator, gas: 2900000 }, function(err, res) {
            assert.equal(err,null);

            assert.equal(byerTokenAmount, mntContract.balanceOf(buyer));

            done();
        });        

     });

     it('should make a purchase',function(done) {

        var ethAmount = 1 * ether;
        var estimateTokenAmount = 0;

        var mntpContractUserBalance1 = mntContract.balanceOf(buyer);
        var powhContractUserBalance1 = 0;


        var ethContractBalance1 = web3.eth.getBalance(powhContractAddress);

        powhContract.getCurrentUserTokenBalance({ from: buyer, gas: 2900000 }, function(err, res) { 
            powhContractUserBalance1 = res;
        });


        powhContract.estimateBuyOrder(ethAmount, { from: buyer, gas: 2900000}, function(err, res) {
            estimateTokenAmount = res[0];
        });


        powhContract.buy(0x0, { from: buyer, gas: 2900000, value: ethAmount }, function(err, res) {
            assert.equal(err, null);

            powhContract.getCurrentUserTokenBalance({ from: buyer, gas: 2900000 }, function(err, res) {
                var powhContractUserBalance2 = res;
                
                assert.equal((powhContractUserBalance2.sub(powhContractUserBalance1)).toString(10), estimateTokenAmount.toString(10));

                var mntpContractUserBalance2 = mntContract.balanceOf(buyer);

                assert.equal(estimateTokenAmount.toString(10), (mntpContractUserBalance2.sub(mntpContractUserBalance1)).toString(10));

                var ethContractBalance2 = web3.eth.getBalance(powhContractAddress);

                assert.equal((ethContractBalance2.sub(powhContractUserBalance1)).toString(10), ethAmount.toString(10));

                done();
            });

        });

     });

     it('should approve transfer behalf buyer', function(done) {

        var tokenAmount = 10 * ether;

        mntContract.approve(powhContractAddress, tokenAmount, { from: buyer, gas: 2900000}, function(err, res) {

            assert.equal(err, null);

            assert.equal(tokenAmount.toString(10), mntContract.allowance(buyer, powhContractAddress).toString(10));

            done();
        });

     });

     it('should not make a sell',function(done) {

        var tokenAmount = 100 * ether;

        powhContract.sell(tokenAmount, { from: buyer, gas: 2900000}, function(err, res) {
            assert.notEqual(err, null);   

            done(); 
        });
     });     

     it('should make a sell',function(done) {

        var tokenAmount = 10 * ether;
        var estimateEthAmount = 0;
        var powhContractUserBalance1 = 0;
        var reward = 0;

        var mntpContrantPowhBalance1 = mntContract.balanceOf(powhContractAddress);

        powhContract.getCurrentUserTokenBalance({ from: buyer, gas: 2900000 }, function(err, res) { 
            powhContractUserBalance1 = res;
        });   

        powhContract.getCurrentUserTokenBalance({ from: buyer, gas: 2900000 }, function(err, res) { 
            powhContractUserBalance1 = res;
        });      
        
        powhContract.calculateReward(tokenAmount, { from: buyer, gas: 2900000 }, function(err, res) { 
            reward = res;
        });               

        powhContract.estimateSellOrder(tokenAmount, { from: buyer, gas: 2900000}, function(err, res) {
            estimateEthAmount = res[0];
        });


        var ethPowhContractBalance1 = web3.eth.getBalance(powhContractAddress);
        var ethBuyerBalance1 = web3.eth.getBalance(buyer);

        powhContract.sell(tokenAmount, { from: buyer, gas: 2900000}, function(err, res) {
            assert.equal(err, null);    

            var mntpContrantPowhBalance2 = mntContract.balanceOf(powhContractAddress);
            
            assert.equal((mntpContrantPowhBalance2.sub(mntpContrantPowhBalance1)).toString(10), tokenAmount.toString(10));

            var ethPowhContractBalance2 = web3.eth.getBalance(powhContractAddress);
            var ethBuyerBalance2 = web3.eth.getBalance(buyer);

            assert.equal((ethPowhContractBalance1.sub(ethPowhContractBalance2)).toString(10), estimateEthAmount.toString(10));

            assert.equal(ethBuyerBalance2.sub(ethBuyerBalance1).sub(estimateEthAmount) < 10000000000, true);


            powhContract.getCurrentUserTokenBalance({ from: buyer, gas: 2900000 }, function(err, res) { 
                var powhContractUserBalance2 = res;

                assert.equal((powhContractUserBalance1.sub(powhContractUserBalance2)).toString(10), tokenAmount.toString(10));

            });                


            done();            

        });
        
        

     });
});