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
var buyer1;
var buyer2;
var buyer3;
var buyer4;


var mntContractAddress;
var mntContract;

var mraContractAddress;
var mraContract;

var ether = 1000000000000000000;
var totalTokenSupply = 0;
var shareFeePercent = 0;    
var refFeePercent = 0;  
var devRewardPercent = 0;  
var priceSpeed = 0; 
var startTokenPrice = 0;
var totalTokenBalance = 0;
var bigPromoInterval = 0;
var quickPromoInterval = 0;
var initBlockNum = 0;
var promoMinPurchase = 0;
var blockNum = 0;


function updateTokenBalance(tokenAmount) {
    totalTokenBalance += parseFloat(tokenAmount.div(1e18).toString(10));
}

function getExpectedTokenPrice() {
    return (startTokenPrice * Math.exp(totalTokenBalance * priceSpeed));
}

async function getCurrentTokenPrice() {
    return realMath.fromReal(await mraContract.getRealCurrentTokenPrice());
}

async function updateBlockNum()
{
    var bn = await mraContract.getBlockNum({from: buyer1});

    blockNum = bn - initBlockNum;
}

eval(fs.readFileSync('./test/helpers/misc.js')+'');

describe('MINTARAMA', function() {

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
               
                deployMintaramaContract(data,function(err){
                    assert.equal(err,null);

                    done();
                });
          });

    });

    it('should issue some MNTP', async() => {

        var mraContractTokenAmount = 2000000*ether;

        await mntContract.issueTokens(mraContractAddress, mraContractTokenAmount, { from: creator, gas: 2900000 });

        assert.equal(mraContractTokenAmount, mntContract.balanceOf(mraContractAddress));

        await mraContract.setTotalSupply(mraContractTokenAmount, { from: creator, gas: 2900000 });
        
        var totalSupply = await mraContract.getTotalTokenSupply();

        assert.equal(totalSupply.sub(mraContractTokenAmount).toString(10), "0".toString(10));

        var buyerTokenAmount = 1000*ether;

        await mntContract.issueTokens(buyer2, buyerTokenAmount, { from: creator, gas: 2900000 });

        assert.equal(buyerTokenAmount, mntContract.balanceOf(buyer2));

        var buyer2MaxPurchase = await mraContract.getCurrentUserMaxPurchase({ from: buyer2, gas: 2900000 });

        assert.equal(buyerTokenAmount, buyer2MaxPurchase);

        await mntContract.issueTokens(buyer1, buyerTokenAmount, { from: creator, gas: 2900000 });        
        assert.equal(buyerTokenAmount, mntContract.balanceOf(buyer1));

    });

    it('init vars', async() => {
        shareFeePercent = await mraContract.MNTP_REWARD_PERCENT();    
        refFeePercent = await mraContract.REF_BONUS_PERCENT();
        totalTokenSupply = await mraContract.getTotalTokenSupply(); 
        priceSpeed = realMath.fromReal(await mraContract.getRealPriceSpeed());  
        devRewardPercent = await mraContract.DEV_REWARD_PERCENT();
        startTokenPrice = (await mraContract.TOKEN_PRICE_INITIAL()).div(1e18);
        initBlockNum = await mraContract.getInitBlockNum();
        
        await mraContract.setBigPromoInterval(7, { from: creator });
        await mraContract.setQuickPromoInterval(5, { from: creator });

        bigPromoInterval = await mraContract.BIG_PROMO_BLOCK_INTERVAL();
        quickPromoInterval = await mraContract.QUICK_PROMO_BLOCK_INTERVAL();
        promoMinPurchase = await mraContract.PROMO_MIN_PURCHASE();
    });


    it('should make a purchase behalf buyer1', async() => {

        {
            var ethAmount = 2 * ether;

            var mntpContractUserBalance1 = mntContract.balanceOf(buyer1);
            var mraContractUserBalance1 = await mraContract.getCurrentUserTokenBalance();

            var ethContractBalance1 = web3.eth.getBalance(mraContractAddress);

            var userReward1 = await mraContract.getUserReward(true);


            var est = await mraContract.estimateBuyOrder(ethAmount);
            var estimateTokenAmount = est[0]; 
            var totalPurchaseFee = est[1];

            updateTokenBalance(estimateTokenAmount);
            var expectedTokenPrice = getExpectedTokenPrice();
            var currentTokenPrice1 = await getCurrentTokenPrice();

            //console.log("expectedTokenPrice: " + expectedTokenPrice);

            var estimatedDevReward = Math.floor(devRewardPercent * totalPurchaseFee / 100);


            var devReward1 = await mraContract.getDevReward();
        }
        
        await mraContract.buy(0x0, { from: buyer1, gas: 2900000, value: ethAmount });
        {
            var mraContractUserBalance2 = mraContract.getCurrentUserTokenBalance({ from: buyer1 });
            assert.equal((mraContractUserBalance2.sub(mraContractUserBalance1)).toString(10), estimateTokenAmount.toString(10));

            var mntpContractUserBalance2 = mntContract.balanceOf(buyer1);
            assert.equal(estimateTokenAmount.toString(10), (mntpContractUserBalance2.sub(mntpContractUserBalance1)).toString(10));
            
            var devReward2 = await mraContract.getDevReward();
            assert.equal(estimatedDevReward.toString(10), devReward2.sub(devReward1).toString(10));

            var ethContractBalance2 = web3.eth.getBalance(mraContractAddress);
            assert.equal((ethContractBalance2.sub(ethContractBalance1)).toString(10), ethAmount.toString(10));

            var userReward2 = await mraContract.getUserReward(true, { from: buyer1 });
            assert.equal(userReward2.sub(userReward1).toString(10), "0");
         
            var currentTokenPrice2 = await getCurrentTokenPrice();

            assert(Math.abs(currentTokenPrice2 - expectedTokenPrice) < 1E-12);
            assert(currentTokenPrice2 > currentTokenPrice1);
            //console.log("currentTokenPrice2: " + currentTokenPrice2)
        }

    });


    it('should make a purchase behalf buyer2', async() => {

        var ethAmount = 1.3 * ether;


        //purchase without a ref
        {
            var mntpContractUserBalance1 = mntContract.balanceOf(buyer2);
            var mraContractUserBalance1 = await mraContract.getCurrentUserTokenBalance({ from: buyer2 });

            var ethContractBalance1 = web3.eth.getBalance(mraContractAddress);


            var userReward1 = await mraContract.getUserReward(true, { from: buyer1 });
            var buyEst = await mraContract.estimateBuyOrder(ethAmount);

            var estimateTokenAmount = buyEst[0];
            var totalPurchaseFee = buyEst[1];

            updateTokenBalance(estimateTokenAmount);
            var expectedTokenPrice = getExpectedTokenPrice();
            var currentTokenPrice1 = await getCurrentTokenPrice();
            //console.log("expectedTokenPrice: " + expectedTokenPrice);

            var buyer1TokenBalance = await mraContract.getLocalTokenBalance(buyer1);

            var buyer2TokenBalance = await mraContract.getLocalTokenBalance(buyer2);
            //console.log("buyer2TokenBalance: " + buyer2TokenBalance);

            var estimatedDevReward = Math.floor(devRewardPercent * totalPurchaseFee / 100);
            var devReward1 = await mraContract.getDevReward();
            var totalShareReward = totalPurchaseFee * shareFeePercent / 100;
            var refReward = totalPurchaseFee * refFeePercent / 100;
            
            var buyer2Reward1 = await mraContract.getUserReward(false, { from: buyer2 });
            //console.log("buyer2Reward1: " + buyer2Reward1);

            var totalTokenSold = await mraContract.getTotalTokenSold();
            

            var esitmatedShareRewardWithoutRefBuyer1 = new BigNumber(Math.floor(((totalShareReward + refReward) / totalTokenSold) * buyer1TokenBalance).toString()); 

            await mraContract.buy(0x0, { from: buyer2, gas: 2900000, value: ethAmount });
            {
 
                var mraContractUserBalance2 = await mraContract.getCurrentUserTokenBalance({ from: buyer2, gas: 2900000 });
                assert.equal((mraContractUserBalance2.sub(mraContractUserBalance1)).toString(10), estimateTokenAmount.toString(10));

                var mntpContractUserBalance2 = mntContract.balanceOf(buyer2);
                assert.equal(estimateTokenAmount.toString(10), (mntpContractUserBalance2.sub(mntpContractUserBalance1)).toString(10));

                var ethContractBalance2 = web3.eth.getBalance(mraContractAddress);
                assert.equal((ethContractBalance2.sub(ethContractBalance1)).toString(10), ethAmount.toString(10));

                var userReward2 = await mraContract.getUserReward(true, { from: buyer1 });
                //console.log("userReward1: " + userReward1.toString(10) + "; userReward2: " + userReward2.toString(10) + "; esitmatedShareRewardWithoutRefBuyer1: " + esitmatedShareRewardWithoutRefBuyer1.toString(10));
                assert.equal(Math.abs(userReward2.sub(userReward1).sub(esitmatedShareRewardWithoutRefBuyer1)) < 20, true);

                var devReward2 = await mraContract.getDevReward();
                assert.equal(estimatedDevReward.toString(10), devReward2.sub(devReward1).toString(10));

                var buyer2Reward2 = await mraContract.getUserReward(false, { from: buyer2 });
                assert.equal(buyer2Reward2.sub(buyer2Reward1).toString(10), "0");
                    
                var currentTokenPrice2 = await getCurrentTokenPrice();
                assert(Math.abs(currentTokenPrice2 - expectedTokenPrice) < 1E-12);
                assert(currentTokenPrice2 > currentTokenPrice1);
            }
        }

        //purchase with a ref
        {
            var buyer1TokenBalance = await mraContract.getLocalTokenBalance(buyer1);
            var buyEst = await mraContract.estimateBuyOrder(ethAmount);
            var estimateTokenAmount = buyEst[0];
            var totalPurchaseFee = buyEst[1];

            updateTokenBalance(estimateTokenAmount);
            var expectedTokenPrice = getExpectedTokenPrice();
            var currentTokenPrice1 = await getCurrentTokenPrice();

            var totalShareReward = totalPurchaseFee * shareFeePercent / 100;
            var totalRefReward = totalPurchaseFee * refFeePercent / 100;
            var totalTokenSold = await mraContract.getTotalTokenSold();

            esitmatedShareRewardWithRefBuyer1 = new BigNumber(Math.floor((totalShareReward / totalTokenSold) * buyer1TokenBalance).toString()); 
            totalRefReward = new BigNumber(totalRefReward.toString());

            buyer1Reward1 = await mraContract.getUserReward(true, { from: buyer1 });
            
            await mraContract.buy(buyer1, { from: buyer2, gas: 2900000, value: ethAmount });    

            buyer1Reward2 = await mraContract.getUserReward(true, { from: buyer1 });

            //console.log("buyer1Reward1: " + buyer1Reward1.toString(10) + "; buyer1Reward2: " + buyer1Reward2.toString(10) + "; esitmatedShareRewardWithRefBuyer1: " + esitmatedShareRewardWithRefBuyer1.toString(10) + "; totalRefReward: " + totalRefReward.toString(10));

            assert(Math.abs(buyer1Reward2.sub(buyer1Reward1).sub(esitmatedShareRewardWithRefBuyer1).sub(totalRefReward)) < 20);
            
            var currentTokenPrice2 = await getCurrentTokenPrice();
            assert(Math.abs(currentTokenPrice2 - expectedTokenPrice) < 1E-12);
            assert(currentTokenPrice2 > currentTokenPrice1);
        }

    });

    it('should not make a purchase behalf buyer3',  function(done) {

        var ethAmount = 2.5 * ether;
        mraContract.estimateBuyOrder(ethAmount, function(err, est) {

            var estimateTokenAmount = est[0]; 
            
            mraContract.getCurrentUserMaxPurchase({ from: buyer3, gas: 2900000 }, function(err, maxPurchase) {
                
                assert(maxPurchase.sub(estimateTokenAmount) < 0);
    
                web3.eth.sendTransaction({ from: buyer3, to: mraContractAddress, value: ethAmount, gas: 2900000 }, function(err, res) {
                    assert.notEqual(err, null);   
        
                    done();
                });

            });

        });

    });

    it('should make a purchase behalf buyer3', async() => {

        var ethAmount = 2.5 * ether;

        var est = await mraContract.estimateBuyOrder(ethAmount);
        var estimateTokenAmount = est[0]; 

        await mntContract.issueTokens(buyer3, estimateTokenAmount, { from: creator, gas: 2900000 });

        var mntpContractUserBalance1 = mntContract.balanceOf(buyer3);
        
        updateTokenBalance(estimateTokenAmount);
        var expectedTokenPrice = getExpectedTokenPrice();
        var currentTokenPrice1 = await getCurrentTokenPrice();
        //console.log("currentTokenPrice1: " + currentTokenPrice1.toString(10));

        await web3.eth.sendTransaction({ from: buyer3, to: mraContractAddress, value: ethAmount, gas: 2900000 });

        var mntpContractUserBalance2 = mntContract.balanceOf(buyer3);
        assert.equal(estimateTokenAmount.toString(10), (mntpContractUserBalance2.sub(mntpContractUserBalance1)).toString(10));

        var currentTokenPrice2 = await getCurrentTokenPrice();
        //console.log("currentTokenPrice2: " + currentTokenPrice2.toString(10) + "; expectedTokenPrice: " + expectedTokenPrice.toString(10));
        assert(Math.abs(currentTokenPrice2 - expectedTokenPrice) < 1E-12);
        assert(currentTokenPrice2 > currentTokenPrice1);
    });


    it('should approve transfer behalf buyer1', async() => {

        var tokenAmount = 10 * ether;

        await mntContract.approve(mraContractAddress, tokenAmount, { from: buyer1, gas: 2900000});

        assert.equal(tokenAmount.toString(10), mntContract.allowance(buyer1, mraContractAddress).toString(10));

    });


    it('should not make a sell', function(done) {
        var tokenAmount = 20 * ether;

        mraContract.sell(tokenAmount, { from: buyer1, gas: 2900000}, function(err, res) {
            assert.notEqual(err, null);   

            done(); 
        });
    });     


    it('should make a sell behalf buyer1', async() => {
        //init vars
        {
            var tokenAmount = new BigNumber((10 * ether).toString());

            var mraContractUserBalance1 = await mraContract.getCurrentUserTokenBalance({ from: buyer1 });
            var buyer1TokenBalance = await mraContract.getLocalTokenBalance(buyer1);
            var buyer2TokenBalance = await mraContract.getLocalTokenBalance(buyer2);

            assert(buyer1TokenBalance > tokenAmount);
            
            var buyer1Reward1 = await mraContract.getUserReward(false, { from: buyer1 });
            var buyer2Reward1 = await mraContract.getUserReward(false, { from: buyer2 });

            var mntpContrantPowhBalance1 = mntContract.balanceOf(mraContractAddress);

            var sellEst = await mraContract.estimateSellOrder(tokenAmount);             
            var estimatedEthAmount = sellEst[0];
            var estimatedTotalFee = sellEst[2];
            //console.log("estimatedEthAmount: " + estimatedEthAmount.toString(10) + "; estimatedTotalFee: " + estimatedTotalFee.toString(10) + "; shareFeePercent: " + shareFeePercent);

            updateTokenBalance(tokenAmount.mul(-1));
            var expectedTokenPrice = getExpectedTokenPrice();
            var currentTokenPrice1 = await getCurrentTokenPrice();
            //console.log("expectedTokenPrice: " + expectedTokenPrice);

            var totalShareReward = estimatedTotalFee * (shareFeePercent.add(refFeePercent)) / 100;
            var totalTokenSold = await mraContract.getTotalTokenSold();
            //console.log("totalShareReward: " + totalShareReward + "; totalTokenSold: " + totalTokenSold.toString(10));

            var estimatedDevReward = Math.floor(devRewardPercent * estimatedTotalFee / 100);


            var buyer2EsitmatedShareReward = new BigNumber(Math.floor((totalShareReward / (totalTokenSold.sub(tokenAmount))) * buyer2TokenBalance).toString()); 
            var buyer1EsitmatedShareReward = new BigNumber(Math.floor((totalShareReward / (totalTokenSold.sub(tokenAmount))) * buyer1TokenBalance).toString()); 

            var devReward1 = await mraContract.getDevReward();
            
            var ethPowhContractBalance1 = web3.eth.getBalance(mraContractAddress);
            var ethBuyer1Balance1 = web3.eth.getBalance(buyer1);
        }

        await mraContract.sell(tokenAmount, { from: buyer1, gas: 2900000});
        {
            var buyer2Reward2 = await mraContract.getUserReward(false, { from: buyer2 });

            //console.log("buyer2Reward1: " + buyer2Reward1.toString(10) + "; buyer2Reward2: " + buyer2Reward2.toString(10) + "; buyer2EsitmatedShareReward: " + buyer2EsitmatedShareReward.toString(10));

            assert(Math.abs(buyer2Reward2.sub(buyer2Reward1).sub(buyer2EsitmatedShareReward)) < 20);   
            var buyer1Reward2 = await mraContract.getUserReward(false, { from: buyer1 });
            /*
            console.log("buyer1Reward1: " + buyer1Reward1);
            console.log("buyer1Reward2: " + buyer1Reward2);
            console.log("buyer1EsitmatedShareReward: " + buyer1EsitmatedShareReward);
            */
            var mntpContrantPowhBalance2 = mntContract.balanceOf(mraContractAddress);
            assert.equal((mntpContrantPowhBalance2.sub(mntpContrantPowhBalance1)).toString(10), tokenAmount.toString(10));

            var ethPowhContractBalance2 = web3.eth.getBalance(mraContractAddress);
            var ethBuyer1Balance2 = web3.eth.getBalance(buyer1);

            assert.equal((ethPowhContractBalance1.sub(ethPowhContractBalance2)).toString(10), estimatedEthAmount.toString(10));

            assert(ethBuyer1Balance2.sub(ethBuyer1Balance1).sub(estimatedEthAmount) < 10000000000);

            var mraContractUserBalance2 = await mraContract.getCurrentUserTokenBalance({ from: buyer1 });

            assert.equal((mraContractUserBalance1.sub(mraContractUserBalance2)).toString(10), tokenAmount.toString(10));

            var devReward2 = await mraContract.getDevReward();
            assert.equal(estimatedDevReward.toString(10), devReward2.sub(devReward1).toString(10));    


            var esitmatedShareRewardForSoldTokens = await mraContract.calculateReward(tokenAmount);
            //console.log("esitmatedShareRewardForSoldTokens: " + esitmatedShareRewardForSoldTokens);

            var currentTokenPrice2 = await getCurrentTokenPrice();
            //console.log("currentTokenPrice: " + currentTokenPrice);
            assert(Math.abs(currentTokenPrice2 - expectedTokenPrice) < 1E-12);    
            assert(currentTokenPrice1 > currentTokenPrice2);        
        } 
          
    });


    it('should withdraw reward', async() => {
        
        var buyer1EthBalance1 = web3.eth.getBalance(buyer1);
        var mraContractEthBalance1 = web3.eth.getBalance(mraContractAddress);
        var buyer1Reward1 = await mraContract.getUserReward(true, { from: buyer1 });
        var buyer1BonusReward1 = await mraContract.getPromoBonus({ from: buyer1 });
        
        console.log("buyer1Reward1: " + buyer1Reward1.toString(10));
        assert(buyer1Reward1 > 0);
        await mraContract.withdraw({ from: buyer1 });

        var buyer1EthBalance2 = web3.eth.getBalance(buyer1);
        var buyer1Reward2 = await mraContract.getUserReward(true, { from: buyer1 });
        console.log("buyer1Reward2: " + buyer1Reward2.toString(10));
        
        assert(Math.abs(buyer1EthBalance2.sub(buyer1EthBalance1).sub(buyer1Reward1).sub(buyer1BonusReward1)) < 100000);

        assert.equal(buyer1Reward2.toString(10), "0");
    });

    

    it('should check promo bonuses', async() => {

        var promoBonus1 = await mraContract.getPromoBonus({ from: buyer1 });
        
        await updateBlockNum();

        if (blockNum % quickPromoInterval == 0) await mraContract.buy(0x0, { from: buyer1, gas: 2900000, value: 0.01 * ether });
        
        //should not win if a purchase is too small
        
        {
            await updateBlockNum();

            while(blockNum % quickPromoInterval != 0) {
                var promoBonus = await mraContract.getPromoBonus({ from: buyer1 });
                var ethAmount = 0.1 * ether;

                assert(promoBonus.sub(promoBonus1) == 0);

                await mraContract.buy(0x0, { from: buyer1, gas: 2900000, value: ethAmount });

                var est = await mraContract.estimateBuyOrder(ethAmount);
                var estimateTokenAmount = est[0]; 
                
                assert(promoMinPurchase.sub(estimateTokenAmount) > 0);

                await updateBlockNum();
                promoBonus = await mraContract.getPromoBonus({ from: buyer1 });
            }

            var promoBonus2 = await mraContract.getPromoBonus({ from: buyer1 });

            assert(promoBonus2.sub(promoBonus1) == 0);
        }

        var promoBonus1 = await mraContract.getPromoBonus({ from: buyer1 });

        // should win if a purchase is enough
        {
            var ethAmount = 2 * ether;
            var est = await mraContract.estimateBuyOrder(ethAmount);
            var estimateTokenAmount = est[0]; 
            await updateBlockNum();

            assert(estimateTokenAmount.sub(promoMinPurchase) > 0);

            if (blockNum % quickPromoInterval == 0) await mraContract.buy(0x0, { from: buyer1, gas: 2900000, value: 0.01 * ether });
            await updateBlockNum();


            while(blockNum % quickPromoInterval != 0) {
                var promoBonus = await mraContract.getPromoBonus({ from: buyer1 });
                //console.log("1 - blockNum: " + blockNum + "; promoBonus: " + promoBonus.toString(10) +"; promoBonus1: " + promoBonus1.toString(10));

                assert(promoBonus.sub(promoBonus1) == 0);

                await mraContract.buy(0x0, { from: buyer1, gas: 2900000, value: ethAmount });
                await updateBlockNum();
                promoBonus = await mraContract.getPromoBonus({ from: buyer1 });
                //console.log("2 - blockNum: " + blockNum + "; promoBonus: " + promoBonus.toString(10) +"; promoBonus1: " + promoBonus1.toString(10));
            }

            var promoBonus2 = await mraContract.getPromoBonus({ from: buyer1 });
            //console.log("promoBonus2: " + promoBonus2);
            assert(promoBonus2.sub(promoBonus1) > 0);

            await updateBlockNum();
            if (blockNum % bigPromoInterval == 0) await mraContract.buy(0x0, { from: buyer1, gas: 2900000, value: 0.01 * ether });
            
            await updateBlockNum();

            while(blockNum % bigPromoInterval != 0) {
                var promoBonus = await mraContract.getPromoBonus({ from: buyer1 });

                assert(promoBonus.sub(promoBonus2) == 0);

                await mraContract.buy(0x0, { from: buyer1, gas: 2900000, value: ethAmount });
                await updateBlockNum();
                //console.log("blockNum: " + blockNum + "; promoBonus: " + promoBonus.toString(10) +"; promoBonus2: " + promoBonus2.toString(10));
            }

            var promoBonus3 = await mraContract.getPromoBonus({ from: buyer1 });

            assert(promoBonus3.sub(promoBonus2) > 0);
        }
    });


    it('should test economy model', async() => {

        //sell all tokens back
        {

            var buyer1Reward1 = await mraContract.getUserReward(true, { from: buyer1 });
            var buyer2Reward1 = await mraContract.getUserReward(true, { from: buyer2 });
            var buyer3Reward1 = await mraContract.getUserReward(true, { from: buyer3 });

            var tokenPrice1 = await mraContract.get1TokenBuyPrice();
            console.log("tokenPrice1 " + tokenPrice1);

            var buyer1TokenBalance1 = await mraContract.getCurrentUserTokenBalance({ from: buyer1 });
            var buyer2TokenBalance1 = await mraContract.getCurrentUserTokenBalance({ from: buyer2 });
            var buyer3TokenBalance1 = await mraContract.getCurrentUserTokenBalance({ from: buyer3 });

            console.log("buyer1TokenBalance1 " + buyer1TokenBalance1);
            console.log("buyer2TokenBalance1 " + buyer2TokenBalance1);
            console.log("buyer3TokenBalance1 " + buyer3TokenBalance1);
            console.log("------------");

            await mntContract.approve(mraContractAddress, buyer1TokenBalance1, { from: buyer1, gas: 2900000});
            await mntContract.approve(mraContractAddress, buyer2TokenBalance1, { from: buyer2, gas: 2900000});
            await mntContract.approve(mraContractAddress, buyer3TokenBalance1, { from: buyer3, gas: 2900000});

            await mraContract.sell(buyer1TokenBalance1, { from: buyer1, gas: 2900000});
            await mraContract.sell(buyer2TokenBalance1, { from: buyer2, gas: 2900000});
            await mraContract.sell(buyer3TokenBalance1, { from: buyer3, gas: 2900000});

            var buyer1TokenBalance2 = await mraContract.getCurrentUserTokenBalance({ from: buyer1 });
            var buyer2TokenBalance2 = await mraContract.getCurrentUserTokenBalance({ from: buyer2 });
            var buyer3TokenBalance2 = await mraContract.getCurrentUserTokenBalance({ from: buyer3 });

            console.log("buyer1TokenBalance2 " + buyer1TokenBalance2);
            console.log("buyer2TokenBalance2 " + buyer2TokenBalance2);
            console.log("buyer3TokenBalance2 " + buyer3TokenBalance2);
            console.log("------------");

            var tokenPrice2 = await getCurrentTokenPrice();
            
            assert(tokenPrice2 == startTokenPrice);
        }

        //withdraw all rewards
        {
            await mraContract.withdraw({ from: buyer1 });
            await mraContract.withdraw({ from: buyer2 });
            await mraContract.withdraw({ from: buyer3 });
        }
        var mraContractEthBalance = web3.eth.getBalance(mraContractAddress);
        console.log("mraContractEthBalance " + mraContractEthBalance);

        var buyer1Reward2 = await mraContract.getUserReward(true, { from: buyer1 });
        var buyer2Reward2 = await mraContract.getUserReward(true, { from: buyer2 });
        var buyer3Reward2 = await mraContract.getUserReward(true, { from: buyer3 });

        console.log("buyer1Reward " + buyer1Reward2.toString(10));
        console.log("buyer2Reward " + buyer2Reward2.toString(10));
        console.log("buyer3Reward " + buyer3Reward2.toString(10));
        console.log("------------");

        var totalUserReward = buyer1Reward2.add(buyer2Reward2).add(buyer3Reward2);
        console.log("totalUserReward " + totalUserReward);

        var devReward = await mraContract.getDevReward();

        var saldo = mraContractEthBalance.sub(totalUserReward).sub(devReward);

        console.log("devReward " + devReward);
        console.log("saldo " + saldo);

        assert(mraContractEthBalance.sub(totalUserReward).sub(devReward) >= 0);

    });
});