var solc = require('solc');
var Web3 = require('web3');

var fs = require('fs');
var assert = require('assert');
var BigNumber = require('bignumber.js');

var web3 = new Web3(new Web3.providers.HttpProvider(process.env.ETH_NODE));

var accounts;
var creator;
var buyer1;
var buyer2;
var buyer3;
var buyer4;


var mntContractAddress;
var mntContract;

var powhContractAddress;
var powhContract;

var ether = 1000000000000000000;

var defParamObj = { from: buyer1, gas: 2900000 };

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


        mntContract.issueTokens(buyer1, byerTokenAmount, { from: creator, gas: 2900000 }, function(err, res) {
            assert.equal(err,null);

            assert.equal(byerTokenAmount, mntContract.balanceOf(buyer1));

            done();
        });        

     });

    it('should make a purchase behalf buyer1',function(done) {

        var ethAmount = 2 * ether;
        var estimateTokenAmount = 0;
        var totalPurchaseFee = 0;

        var mntpContractUserBalance1 = mntContract.balanceOf(buyer1);
        var powhContractUserBalance1 = 0;

        var ethContractBalance1 = web3.eth.getBalance(powhContractAddress);

        var userReward1 = 0;

        powhContract.getUserReward(true, defParamObj, function(err, res) { userReward1 = res; });

        powhContract.getCurrentUserTokenBalance(defParamObj, function(err, res) { powhContractUserBalance1 = res; });

        powhContract.estimateBuyOrder(ethAmount, defParamObj, function(err, res) { 
            estimateTokenAmount = res[0]; 
            totalPurchaseFee = res[1];
        });

        var devRewardPercent = 0;
        var estimatedDevReward = 0;
        powhContract.getDevRewardPercent(defParamObj, function(err, res) { 
            devRewardPercent = res; 
            estimatedDevReward = Math.floor(devRewardPercent * totalPurchaseFee / 100);
        });    

        var devReward1 = 0;
        powhContract.getDevReward(defParamObj, function(err, res) { devReward1 = res; });

        powhContract.buy(0x0, { from: buyer1, gas: 2900000, value: ethAmount }, function(err, res) {
            assert.equal(err, null);

            powhContract.getDevReward(defParamObj, function(err, res) {
                var devReward2 = res;
                assert.equal(estimatedDevReward.toString(10), devReward2.sub(devReward1).toString(10));
            });

            powhContract.getCurrentUserTokenBalance({ from: buyer1, gas: 2900000 }, function(err, res) {
                var powhContractUserBalance2 = res;
                
                assert.equal((powhContractUserBalance2.sub(powhContractUserBalance1)).toString(10), estimateTokenAmount.toString(10));

                var mntpContractUserBalance2 = mntContract.balanceOf(buyer1);

                assert.equal(estimateTokenAmount.toString(10), (mntpContractUserBalance2.sub(mntpContractUserBalance1)).toString(10));

                var ethContractBalance2 = web3.eth.getBalance(powhContractAddress);

                assert.equal((ethContractBalance2.sub(ethContractBalance1)).toString(10), ethAmount.toString(10));

                var userReward2 = 0;

                powhContract.getUserReward(true, { from: buyer1, gas: 2900000 }, function(err, res) { 
                    userReward2 = res;
                });

                assert.equal(userReward2.toString(10), "0");

                done();
            });
        });

     });

    it('should make a purchase behalf buyer2',function(done) {

        var ethAmount = 1.3 * ether;
        var estimateTokenAmount = 0;

        var mntpContractUserBalance1 = mntContract.balanceOf(buyer2);
        var powhContractUserBalance1 = 0;

        var ethContractBalance1 = web3.eth.getBalance(powhContractAddress);

        var userReward1 = 0;

        powhContract.getUserReward(true, { from: buyer1, gas: 2900000 }, function(err, res) { userReward1 = res; });

        powhContract.getCurrentUserTokenBalance({ from: buyer2, gas: 2900000 }, function(err, res) { 
            powhContractUserBalance1 = res;
        });

        var totalPurchaseFee = 0;

        powhContract.estimateBuyOrder(ethAmount, defParamObj, function(err, res) {
            estimateTokenAmount = res[0];
            totalPurchaseFee = res[1];
        });

        var buyer1TokenBalance = 0

        powhContract.getUserTokenBalance(buyer1, { from: buyer2, gas: 2900000}, function(err, res) {
            buyer1TokenBalance = res;
        });

        var totalTokenSupply = 0;
        var totalShareReward = 0;
        var esitmatedShareRewardBuyer1 = 0;

        var shareFeePercent = 0;
        powhContract.getShareRewardPercent(defParamObj, function(err, res) { shareFeePercent = res; });    

        var devRewardPercent = 0;
        var estimatedDevReward = 0;
        powhContract.getDevRewardPercent(defParamObj, function(err, res) { 
            devRewardPercent = res; 
            estimatedDevReward = Math.floor(devRewardPercent * totalPurchaseFee / 100);
        });    

        var devReward1 = 0;
        powhContract.getDevReward(defParamObj, function(err, res) { devReward1 = res; });

        powhContract.getTotalTokenSupply({from: buyer2, gas: 2900000}, function(err, res) {
            totalTokenSupply = res;

            var totalShareReward = totalPurchaseFee * shareFeePercent / 100;
            
            var esitmatedShareRewardBuyer1 = Math.floor((totalShareReward / totalTokenSupply) * buyer1TokenBalance);       

            powhContract.buy(0x0, { from: buyer2, gas: 2900000, value: ethAmount }, function(err, res) {
                assert.equal(err, null);

                powhContract.getCurrentUserTokenBalance({ from: buyer2, gas: 2900000 }, function(err, res) {
                    var powhContractUserBalance2 = res;
                    
                    assert.equal((powhContractUserBalance2.sub(powhContractUserBalance1)).toString(10), estimateTokenAmount.toString(10));

                    var mntpContractUserBalance2 = mntContract.balanceOf(buyer2);

                    assert.equal(estimateTokenAmount.toString(10), (mntpContractUserBalance2.sub(mntpContractUserBalance1)).toString(10));

                    var ethContractBalance2 = web3.eth.getBalance(powhContractAddress);

                    assert.equal((ethContractBalance2.sub(ethContractBalance1)).toString(10), ethAmount.toString(10));

                    var userReward2 = 0;

                    powhContract.getUserReward(false, { from: buyer1, gas: 2900000 }, function(err, res) { 
                        userReward2 = res;
                        
                        assert.equal(Math.abs(userReward2.sub(userReward1).sub(esitmatedShareRewardBuyer1)) < 2, true);
                    });

                    powhContract.getDevReward(defParamObj, function(err, res) {
                        var devReward2 = res;
                        assert.equal(estimatedDevReward.toString(10), devReward2.sub(devReward1).toString(10));
                    });

                    done();
                });
            });

        });

    });

     it('should approve transfer behalf buyer1', function(done) {

        var tokenAmount = 10 * ether;

        mntContract.approve(powhContractAddress, tokenAmount, { from: buyer1, gas: 2900000}, function(err, res) {

            assert.equal(err, null);

            assert.equal(tokenAmount.toString(10), mntContract.allowance(buyer1, powhContractAddress).toString(10));

            done();
        });

     });

     it('should not make a sell',function(done) {

        var tokenAmount = 100 * ether;

        powhContract.sell(tokenAmount, { from: buyer1, gas: 2900000}, function(err, res) {
            assert.notEqual(err, null);   

            done(); 
        });
     });     

     it('should make a sell',function(done) {

        var tokenAmount = 10 * ether;
        var estimatedEthAmount = 0;
        var estimatedTotalFee = 0;

        var powhContractUserBalance1 = 0;
        var reward = 0;

        var mntpContrantPowhBalance1 = mntContract.balanceOf(powhContractAddress);

        powhContract.getCurrentUserTokenBalance({ from: buyer1, gas: 2900000 }, function(err, res) { 
            powhContractUserBalance1 = res;
        });   

        powhContract.getCurrentUserTokenBalance({ from: buyer1, gas: 2900000 }, function(err, res) { 
            powhContractUserBalance1 = res;
        });      
        
        powhContract.calculateReward(tokenAmount, { from: buyer1, gas: 2900000 }, function(err, res) { 
            reward = res;
        });               

        powhContract.estimateSellOrder(tokenAmount, { from: buyer1, gas: 2900000}, function(err, res) {
            estimatedEthAmount = res[0];
            estimatedTotalFee = res[2];
        });


        var devRewardPercent = 0;
        var estimatedDevReward = 0;
        powhContract.getDevRewardPercent(defParamObj, function(err, res) { 
            devRewardPercent = res; 
            estimatedDevReward = Math.floor(devRewardPercent * estimatedTotalFee / 100);
        });    

        var devReward1 = 0;
        powhContract.getDevReward(defParamObj, function(err, res) { devReward1 = res; });
        
        var ethPowhContractBalance1 = web3.eth.getBalance(powhContractAddress);
        var ethBuyer1Balance1 = web3.eth.getBalance(buyer1);

        powhContract.sell(tokenAmount, { from: buyer1, gas: 2900000}, function(err, res) {
            assert.equal(err, null);    

            var mntpContrantPowhBalance2 = mntContract.balanceOf(powhContractAddress);
            
            assert.equal((mntpContrantPowhBalance2.sub(mntpContrantPowhBalance1)).toString(10), tokenAmount.toString(10));

            var ethPowhContractBalance2 = web3.eth.getBalance(powhContractAddress);
            var ethBuyer1Balance2 = web3.eth.getBalance(buyer1);

            assert.equal((ethPowhContractBalance1.sub(ethPowhContractBalance2)).toString(10), estimatedEthAmount.toString(10));

            assert.equal(ethBuyer1Balance2.sub(ethBuyer1Balance1).sub(estimatedEthAmount) < 10000000000, true);


            powhContract.getCurrentUserTokenBalance({ from: buyer1, gas: 2900000 }, function(err, res) { 
                var powhContractUserBalance2 = res;

                assert.equal((powhContractUserBalance1.sub(powhContractUserBalance2)).toString(10), tokenAmount.toString(10));

            });                

            powhContract.getDevReward(defParamObj, function(err, res) {
                var devReward2 = res;
                assert.equal(estimatedDevReward.toString(10), devReward2.sub(devReward1).toString(10));
            });

            done();            

        });
        
        

     });
});