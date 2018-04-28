var solc = require('solc');
var Web3 = require('web3');

var fs = require('fs');
var assert = require('assert');
var BigNumber = require('bignumber.js');

// You must set this ENV VAR before testing
//assert.notEqual(typeof(process.env.ETH_NODE),'undefined');
var web3 = new Web3(new Web3.providers.HttpProvider(process.env.ETH_NODE));

var accounts;
var creator;
var buyer;
var buyer2;
var buyer3;
var buyer4;

var goldmintTeamAddress;

var initialBalanceCreator = 0;

var mntContractAddress;
var mntContract;

var goldFeeContractAddress;
var goldFeeContract;

var goldContractAddress;
var goldContract;

var goldIssueBurnFeeContractAddress;
var goldIssueBurnFeeContract;

var storageControllerContractAddress;
var storageControllerContract;
var storageControllerContractOld;


var hotWalletTokenHolderAddress;


eval(fs.readFileSync('./test/helpers/misc.js')+'');

describe('ETH_REQ 1', function() {

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
               
               deployGoldFeeContract(data,function(err){
                    assert.equal(err,null);
                    
                    // same as deployGoldContract but deploys 
                    // Gold from Goldmint.sol file
                    deployGoldContract(data,function(err){
                         assert.equal(err,null);

                         deployGoldIssueBurnFeeContract(data,function(err){
                              assert.equal(err,null);

                              deployStorageControllerContract(data,function(err){
                                    assert.equal(err,null);

                                    done();
                              });

                         });
                    });
               });
          });
     });   

      it('should set storage controller address',function(done){
          goldContract.setStorageControllerContractAddress(
               storageControllerContractAddress,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);
                    done();
               }
          );
     });

     it('should add buy request', function(done){

           var amount = 500000000000000000;

            storageControllerContract.addBuyTokensRequest("1", 1,
                  {
                        from: buyer,               
                        gas: 2900000000,
                        value: amount
                  },function(err,res){
                        assert.equal(err,null);
                                          
                        var totalBalance = web3.eth.getBalance(storageControllerContractAddress);
                        
                        assert.equal(totalBalance,amount);

                        assert.equal(storageControllerContract.getRequestsCount(), 1);

                        var req = storageControllerContract.getRequest(0);
                        
                        assert.equal(req[0], buyer);
                        assert.equal(req[1], "1");
                        assert.equal(req[2], 1);
                        assert.equal(req[3], true);
                        assert.equal(req[4], 0);
                        assert.equal(req[5], amount);

                        done();
                  });
     });  


     it('should process buy request', function(done){

         storageControllerContract.processRequest(0, 2000000000000000000,
            {
                  from: creator,               
                  gas: 2900000000
            },function(err,res){
                  assert.equal(err,null);

                  var buyerBalance = goldContract.balanceOf(buyer);

                  assert.equal(buyerBalance.toString(10),"250000000000000000");

                  done();
            });
     });

      it('should add sell request', function(done){

            var initBuyerBalance = goldContract.balanceOf(buyer);
            var amount = 150000000000000000;

            storageControllerContract.addSellTokensRequest("1", 2, amount,
                  {
                        from: buyer,               
                        gas: 2900000000
                  },function(err,res){
                        assert.equal(err,null);
                                          
                        var buyerBalance = goldContract.balanceOf(buyer);
                        var contractBalance = goldContract.balanceOf(storageControllerContractAddress);

                        assert.equal(buyerBalance.toString(10), (initBuyerBalance - amount).toString(10));
                        assert.equal(contractBalance.toString(10), "0");

                        assert.equal(storageControllerContract.getRequestsCount(), 2);

                        var req = storageControllerContract.getRequest(1);
                        
                        assert.equal(req[0], buyer);
                        assert.equal(req[1], "1");
                        assert.equal(req[2], 2);
                        assert.equal(req[3], false);
                        assert.equal(req[4], 0);
                        assert.equal(req[5], amount);

                        done();
                  });
      });      
            
     
      it('should process sell request', function(done){

            var amountTokenWeiToSell = 150000000000000000;

            var commissionPercent = 0.03; // for 0 MNTP
            
            var ethPerTokenRate = 2000000000000000000;  

            var mntpBalance  =  mntContract.balanceOf(buyer);
            

            console.log("mntpBalance: " + mntpBalance); // 0 MNTP

            var commission = goldIssueBurnFeeContract.calculateBurnGoldFee(mntpBalance, amountTokenWeiToSell);

            assert.equal(commission.toString(10), (amountTokenWeiToSell * commissionPercent).toString(10));


            var initBuyerEthBalance = web3.eth.getBalance(buyer);


            var requiredAmountWei = (amountTokenWeiToSell * (1-commissionPercent)) * ethPerTokenRate / 1000000000000000000;

            storageControllerContract.processRequest(1, ethPerTokenRate,
                  {
                        from: creator,               
                        gas: 2900000000
                  },function(err,res){
                        assert.equal(err,null);

                        var buyerEthBalance = web3.eth.getBalance(buyer);
                              
                        assert.equal((buyerEthBalance - initBuyerEthBalance).toString(10), requiredAmountWei.toString(10));

                        //assert.equal(buyerTokenBalance.toString(10), "250000000000000000");

                        done();
                  });
      }); 

      it('should add buy request 2', function(done){

            var amount = 500000000000000000;

            var balanceBefore = web3.eth.getBalance(storageControllerContractAddress);

            storageControllerContract.addBuyTokensRequest("2", 2,
            {
                  from: buyer2,               
                  gas: 2900000000,
                  value: amount
            },function(err,res){
                  assert.equal(err,null);
                                    
                  var balanceAfter = web3.eth.getBalance(storageControllerContractAddress);
                  
                  assert.equal((balanceAfter - balanceBefore).toString(10),amount.toString(10));

                  assert.equal(storageControllerContract.getRequestsCount(), 3);

                  done();
            });
      });  

      it('should cancel buy request 2', function(done){

            var buyerBalanceBefore = web3.eth.getBalance(buyer2);
            var contractBalanceBefore = web3.eth.getBalance(storageControllerContractAddress);

            var amount = 500000000000000000;

            storageControllerContract.cancelRequest(2, 
            {
                  from: creator,               
                  gas: 2900000000
            },function(err,res){
                  assert.equal(err,null);

                  var buyerBalanceAfter = web3.eth.getBalance(buyer2);                  
                  var contractBalanceAfter = web3.eth.getBalance(storageControllerContractAddress);
                  
                  assert.equal((buyerBalanceAfter - buyerBalanceBefore).toString(10), amount.toString(10));
                  assert.equal((contractBalanceBefore - contractBalanceAfter).toString(10), amount.toString(10));


                  done();
            });
      });

       it('should add sell request 2', function(done){

            var initBuyerBalance = goldContract.balanceOf(buyer);
            var amount = 50000000000000000;

            storageControllerContract.addSellTokensRequest("2", 4, amount,
            {
                  from: buyer,               
                  gas: 2900000000
            },function(err,res){
                  assert.equal(err,null);
                                    
                  var buyerBalance = goldContract.balanceOf(buyer);
                  assert.equal(buyerBalance.toString(10), (initBuyerBalance - amount).toString(10));
                  assert.equal(storageControllerContract.getRequestsCount(), 4);
                  done();
            });
      }); 

      it('should cancel sell request 2', function(done){

            var buyerBalanceBefore = goldContract.balanceOf(buyer);
            var amount = 50000000000000000;

            storageControllerContract.cancelRequest(3, 
            {
                  from: creator,               
                  gas: 2900000000
            },function(err,res){
                  assert.equal(err,null);

                  var buyerBalanceAfter = goldContract.balanceOf(buyer);                  
                  
                  assert.equal((buyerBalanceAfter - buyerBalanceBefore).toString(10), amount.toString(10));


                  done();
            });
      });      
});