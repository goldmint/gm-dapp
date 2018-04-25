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

var storageContractAddress;
var storageContract;

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

                             deployStorageContract(data,function(err){
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

 

     it('should add buy request', function(done){
        console.log("getStorAddress: " + storageControllerContract.getDocCount());

        done();
        /*
         storageControllerContract.addBuyTokensRequest("1", 1,
               {
                    from: buyer,               
                    gas: 2900000000,
                    value: 500000000000000000
               },function(err,res){
                    assert.equal(err,null);
                    
                    console.log(storageControllerContractAddress);
                    
                    var totalBalance = web3.eth.getBalance(storageControllerContractAddress);
                    console.log(totalBalance);
                    assert.equal(totalBalance,500000000000000000);

                    done();
               });

               */
     })  
});