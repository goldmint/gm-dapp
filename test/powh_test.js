var solc = require('solc');
var Web3 = require('web3');
var expect = require('chai').expect;

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
var totalTokenSupply = 0;
var shareFeePercent = 0;    
var refFeePercent = 0;     

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

    it('should deploy token contract', function(done) {
          var data = {};

          deployMntContract(data,function(err){
               assert.equal(err,null);
               
                deployGoldmintPowhContract(data,function(err){
                    assert.equal(err,null);

                    done();
                });
          });

    });


    it('should issue some MNTP', async() => {

        var powhContractTokenAmount = 2000000*ether;

        await mntContract.issueTokens(powhContractAddress, powhContractTokenAmount, { from: creator, gas: 2900000 });

        assert.equal(powhContractTokenAmount, mntContract.balanceOf(powhContractAddress));

        await powhContract.setTotalSupply(powhContractTokenAmount, { from: creator, gas: 2900000 });
        
        var totalSupply = await powhContract.getTotalTokenSupply();

        assert.equal(totalSupply.sub(powhContractTokenAmount).toString(10), "0".toString(10));

        var byerTokenAmount = 1000*ether;

        await mntContract.issueTokens(buyer2, byerTokenAmount, { from: creator, gas: 2900000 });

        assert.equal(byerTokenAmount, mntContract.balanceOf(buyer2));

        var buyer2MaxPurchase = await powhContract.getCurrentUserMaxPurchase({ from: buyer2, gas: 2900000 });

        assert.equal(byerTokenAmount, buyer2MaxPurchase);

        await mntContract.issueTokens(buyer1, byerTokenAmount, { from: creator, gas: 2900000 });        
        assert.equal(byerTokenAmount, mntContract.balanceOf(buyer1));

    });

    it('init vars', async() => {
        shareFeePercent = await powhContract.getShareRewardPercent();    
        refFeePercent = await powhContract.getRefBonusPercent();
        totalTokenSupply = await powhContract.getTotalTokenSupply();     
    });



    it('should make a purchase behalf buyer1', async() => {

        var ethAmount = 2 * ether;

        var mntpContractUserBalance1 = mntContract.balanceOf(buyer1);
        var powhContractUserBalance1 = await powhContract.getCurrentUserTokenBalance();

        var ethContractBalance1 = web3.eth.getBalance(powhContractAddress);

        var userReward1 = await powhContract.getUserReward(true);


        var est = await powhContract.estimateBuyOrder(ethAmount);
        var estimateTokenAmount = est[0]; 
        var totalPurchaseFee = est[1];

        var devRewardPercent = await powhContract.getDevRewardPercent();
        var estimatedDevReward = Math.floor(devRewardPercent * totalPurchaseFee / 100);
  

        var devReward1 = await powhContract.getDevReward();

        await powhContract.buy(0x0, { from: buyer1, gas: 2900000, value: ethAmount });

        var devReward2 = await powhContract.getDevReward();
        assert.equal(estimatedDevReward.toString(10), devReward2.sub(devReward1).toString(10));

        var powhContractUserBalance2 = powhContract.getCurrentUserTokenBalance({ from: buyer1 });
        assert.equal((powhContractUserBalance2.sub(powhContractUserBalance1)).toString(10), estimateTokenAmount.toString(10));

        var mntpContractUserBalance2 = mntContract.balanceOf(buyer1);
        assert.equal(estimateTokenAmount.toString(10), (mntpContractUserBalance2.sub(mntpContractUserBalance1)).toString(10));

        var ethContractBalance2 = web3.eth.getBalance(powhContractAddress);
        assert.equal((ethContractBalance2.sub(ethContractBalance1)).toString(10), ethAmount.toString(10));

        var userReward2 = await powhContract.getUserReward(true, { from: buyer1 });
        assert.equal(userReward2.sub(userReward1).toString(10), "0");

    });

    it('should make a purchase behalf buyer2', async() => {

        var ethAmount = 1.3 * ether;


        //purchase without a ref
        {
            var mntpContractUserBalance1 = mntContract.balanceOf(buyer2);
            var powhContractUserBalance1 = await powhContract.getCurrentUserTokenBalance({ from: buyer2 });

            var ethContractBalance1 = web3.eth.getBalance(powhContractAddress);


            var userReward1 = await powhContract.getUserReward(true, { from: buyer1 });
            var buyEst = await powhContract.estimateBuyOrder(ethAmount);

            var estimateTokenAmount = buyEst[0];
            var totalPurchaseFee = buyEst[1];

            var buyer1TokenBalance = await powhContract.getUserTokenBalance(buyer1);

        
            var devRewardPercent = await powhContract.getDevRewardPercent();;
            var estimatedDevReward = Math.floor(devRewardPercent * totalPurchaseFee / 100);
            var devReward1 = await powhContract.getDevReward();
            var totalShareReward = totalPurchaseFee * shareFeePercent / 100;
            var refReward = totalPurchaseFee * refFeePercent / 100;
            var buyer2Reward1 = await powhContract.getUserReward(true, { from: buyer2 });
            var totalTokenSold = await powhContract.getTotalTokenSold();
            

            var esitmatedShareRewardWithoutRefBuyer1 = new BigNumber(Math.floor(((totalShareReward + refReward) / totalTokenSold) * buyer1TokenBalance).toString()); 

            await powhContract.buy(0x0, { from: buyer2, gas: 2900000, value: ethAmount });
            {
                var powhContractUserBalance2 = await powhContract.getCurrentUserTokenBalance({ from: buyer2, gas: 2900000 });
                assert.equal((powhContractUserBalance2.sub(powhContractUserBalance1)).toString(10), estimateTokenAmount.toString(10));

                var mntpContractUserBalance2 = mntContract.balanceOf(buyer2);
                assert.equal(estimateTokenAmount.toString(10), (mntpContractUserBalance2.sub(mntpContractUserBalance1)).toString(10));

                var ethContractBalance2 = web3.eth.getBalance(powhContractAddress);
                assert.equal((ethContractBalance2.sub(ethContractBalance1)).toString(10), ethAmount.toString(10));

                var userReward2 = await powhContract.getUserReward(true, { from: buyer1 });

                assert.equal(Math.abs(userReward2.sub(userReward1).sub(esitmatedShareRewardWithoutRefBuyer1)) < 5, true);

                var devReward2 = await powhContract.getDevReward();
                assert.equal(estimatedDevReward.toString(10), devReward2.sub(devReward1).toString(10));

                var buyer2Reward2 = await powhContract.getUserReward(true, { from: buyer2 });
                assert.equal(buyer2Reward1.toString(10), buyer2Reward2.toString(10));
            }
        }

        //purchase with a ref
        {
            var buyer1TokenBalance = await powhContract.getUserTokenBalance(buyer1);
            var buyEst = await powhContract.estimateBuyOrder(ethAmount);
            var estimateTokenAmount = buyEst[0];
            var totalPurchaseFee = buyEst[1];
            var totalShareReward = totalPurchaseFee * shareFeePercent / 100;
            var totalRefReward = totalPurchaseFee * refFeePercent / 100;
            var totalTokenSold = await powhContract.getTotalTokenSold();

            esitmatedShareRewardWithRefBuyer1 = new BigNumber(Math.floor((totalShareReward / totalTokenSold) * buyer1TokenBalance).toString()); 
            totalRefReward = new BigNumber(totalRefReward.toString());

            buyer1Reward1 = await powhContract.getUserReward(true, { from: buyer1 });
            
            await powhContract.buy(buyer1, { from: buyer2, gas: 2900000, value: ethAmount });    

            buyer1Reward2 = await powhContract.getUserReward(true, { from: buyer1 });

            assert(Math.abs(buyer1Reward2.sub(buyer1Reward1).sub(esitmatedShareRewardWithRefBuyer1).sub(totalRefReward)) < 5);
        }

    });

    it('should make a purchase behalf buyer3', async() => {

        var ethAmount = 2.5 * ether;

        var est = await powhContract.estimateBuyOrder(ethAmount);
        var estimateTokenAmount = est[0]; 
        var mntpContractUserBalance1 = mntContract.balanceOf(buyer3);

        await web3.eth.sendTransaction({ from: buyer3, to: powhContractAddress, value: ethAmount, gas: 2900000 });

        var mntpContractUserBalance2 = mntContract.balanceOf(buyer3);
        assert.equal(estimateTokenAmount.toString(10), (mntpContractUserBalance2.sub(mntpContractUserBalance1)).toString(10));
    });


    it('should approve transfer behalf buyer1', async() => {

        var tokenAmount = 10 * ether;

        await mntContract.approve(powhContractAddress, tokenAmount, { from: buyer1, gas: 2900000});

        assert.equal(tokenAmount.toString(10), mntContract.allowance(buyer1, powhContractAddress).toString(10));

    });

    it('should not make a sell', function(done) {
        var tokenAmount = 20 * ether;

        powhContract.sell(tokenAmount, { from: buyer1, gas: 2900000}, function(err, res) {
            assert.notEqual(err, null);   

            done(); 
        });
    });     


    it('should make a sell behalf buyer1', async() => {
        //init vars
        {
            var tokenAmount = new BigNumber((10 * ether).toString());

            var powhContractUserBalance1 = await powhContract.getCurrentUserTokenBalance({ from: buyer1 });
            var buyer1TokenBalance = await powhContract.getUserTokenBalance(buyer1);
            var buyer2TokenBalance = await powhContract.getUserTokenBalance(buyer2);

            assert(buyer1TokenBalance > tokenAmount);
            
            var buyer1Reward1 = await powhContract.getUserReward(false, { from: buyer1 });
            var buyer2Reward1 = await powhContract.getUserReward(false, { from: buyer2 });

            var mntpContrantPowhBalance1 = mntContract.balanceOf(powhContractAddress);

            var sellEst = await powhContract.estimateSellOrder(tokenAmount);             
            var estimatedEthAmount = sellEst[0];
            var estimatedTotalFee = sellEst[2];


            var totalShareReward = estimatedTotalFee * (shareFeePercent.add(refFeePercent)) / 100;
            var totalTokenSold = await powhContract.getTotalTokenSold();


            var devRewardPercent = await powhContract.getDevRewardPercent();
            var estimatedDevReward = Math.floor(devRewardPercent * estimatedTotalFee / 100);


            var buyer2EsitmatedShareReward = new BigNumber(Math.floor((totalShareReward / (totalTokenSold.sub(tokenAmount))) * buyer2TokenBalance).toString()); 
            var buyer1EsitmatedShareReward = new BigNumber(Math.floor((totalShareReward / (totalTokenSold.sub(tokenAmount))) * buyer1TokenBalance).toString()); 

            var devReward1 = await powhContract.getDevReward();
            
            var ethPowhContractBalance1 = web3.eth.getBalance(powhContractAddress);
            var ethBuyer1Balance1 = web3.eth.getBalance(buyer1);
        }

        await powhContract.sell(tokenAmount, { from: buyer1, gas: 2900000});
        {
            var buyer2Reward2 = await powhContract.getUserReward(false, { from: buyer2 });
            assert(Math.abs(buyer2Reward2.sub(buyer2Reward1).sub(buyer2EsitmatedShareReward)) < 5);   
            var buyer1Reward2 = await powhContract.getUserReward(false, { from: buyer1 });
            
            console.log("buyer1Reward1: " + buyer1Reward1);
            console.log("buyer1Reward2: " + buyer1Reward2);
            console.log("buyer1EsitmatedShareReward: " + buyer1EsitmatedShareReward);
            
            var mntpContrantPowhBalance2 = mntContract.balanceOf(powhContractAddress);
            assert.equal((mntpContrantPowhBalance2.sub(mntpContrantPowhBalance1)).toString(10), tokenAmount.toString(10));

            var ethPowhContractBalance2 = web3.eth.getBalance(powhContractAddress);
            var ethBuyer1Balance2 = web3.eth.getBalance(buyer1);

            assert.equal((ethPowhContractBalance1.sub(ethPowhContractBalance2)).toString(10), estimatedEthAmount.toString(10));

            assert(ethBuyer1Balance2.sub(ethBuyer1Balance1).sub(estimatedEthAmount) < 10000000000);

            var powhContractUserBalance2 = await powhContract.getCurrentUserTokenBalance({ from: buyer1 });

            assert.equal((powhContractUserBalance1.sub(powhContractUserBalance2)).toString(10), tokenAmount.toString(10));

            var devReward2 = await powhContract.getDevReward();
            assert.equal(estimatedDevReward.toString(10), devReward2.sub(devReward1).toString(10));    


            var esitmatedShareRewardForSoldTokens = await powhContract.calculateReward(tokenAmount);
            //console.log("esitmatedShareRewardForSoldTokens: " + esitmatedShareRewardForSoldTokens);


        } 
          
    });


    it('should withdraw reward', async() => {
        
        var buyer1EthBalance1 = web3.eth.getBalance(buyer1);
        var powhContractEthBalance1 = web3.eth.getBalance(powhContractAddress);
        var buyer1Reward1 = await powhContract.getUserReward(true, { from: buyer1 });

        assert(buyer1Reward1 > 0);
        await powhContract.withdraw({ from: buyer1 });

        var buyer1EthBalance2 = web3.eth.getBalance(buyer1);
        var buyer1Reward2 = await powhContract.getUserReward(true, { from: buyer1 });

        assert.equal(buyer1Reward2.toString(10), "0");
        assert(Math.abs(buyer1EthBalance2.sub(buyer1EthBalance1).sub(buyer1Reward1)) < 100000);
    });
});