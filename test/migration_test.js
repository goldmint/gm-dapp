 solc = require('solc');
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

var goldmintTeamAddress;

var initialBalanceCreator = 0;

var mntContractAddress;
var mntContract;

var goldFeeContractAddress;
var goldFeeContract;

var goldContractAddress;
var goldContract;

var goldFiatFeeContractAddress;
var goldFiatFeeContract;

var fiatContractAddress;
var fiatContract;

var migrationContractAddress;
var migrationContract;

var hotWalletTokenHolderAddress;

var newMigrationContractAddress;

eval(fs.readFileSync('./test/helpers/misc.js')+'');



describe('NEW_MIGRATION', function() {

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


     it('should deploy contract',function(done){
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

                              deployMigrationContract(data,function(err){
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

     it('should set migration address',function(done){

         console.log("migrationContractAddress: "  + migrationContractAddress);
          goldContract.setMigrationContractAddress(
               migrationContractAddress,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);
                    done();
               }
          );
     });

     it('should set ico contract address',function(done){
          // set myself
          mntContract.setIcoContractAddress(
               creator,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    done();
               }
          );
     });

     it('should issue some MNTP tokens', function(done){
          var params = {from: creator, gas: 2900000};

          mntContract.issueTokens(buyer, 1000, params, (err,res)=>{
               assert.equal(err, null);

               var balance = mntContract.balanceOf(buyer);
               assert.equal(balance,1000);

               done();
          });
     });

     it('should emit some GOLD tokens to buyer',function(done){
          var balance = goldContract.balanceOf(buyer);
          assert.equal(balance,0);

          var amount = 5000000000000000;
          var params = {from: creator, gas: 2900000};
          goldContract.issueTokens(buyer, amount, params, (err,res)=>{
               assert.equal(err, null);

               var balance = goldContract.balanceOf(buyer);
               assert.equal(balance,5000000000000000);
               done();
          });
     });

     it('should hold MNTP tokens', function(done){
         
         var params = {from: buyer, gas: 2900000};

         mntContract.transfer(migrationContractAddress, 225, params, (err,res)=>{
            assert.equal(err, null);

            var balance = mntContract.balanceOf(migrationContractAddress);
            assert.equal(balance, 225);
            
            done();
         })

     });

    it('should unhold MNTP tokens', function(done){
         
         var params = {from: creator, gas: 2900000};

         migrationContract.unholdMntp(buyer, 225, params, (err,res)=>{
            assert.equal(err, null);

            var balance = mntContract.balanceOf(buyer);
            assert.equal(balance, 1000);
            
            done();
         })

     });


    it('should hold GOLD tokens', function(done){

         var params = {from: buyer, gas: 2900000};

         goldContract.transfer(migrationContractAddress, 225, params, (err,res)=>{
            assert.equal(err, null);

            var balance = goldContract.balanceOf(migrationContractAddress);
            assert.equal(balance, 225);
            
            done();
         })

     });

    it('should unhold GOLD tokens', function(done){
         
         var params = {from: creator, gas: 2900000};

         var balanceBefore = goldContract.balanceOf(buyer);

         migrationContract.unholdGold(buyer, 225, params, (err,res)=>{
            assert.equal(err, null);

            var balanceAfter = goldContract.balanceOf(buyer);
            assert.equal(balanceAfter - balanceBefore, 225);
            
            done();
         })

     });


});

