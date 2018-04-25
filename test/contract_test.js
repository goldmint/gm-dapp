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
var goldmintTeam;

var buyer;
var buyer2;
var buyers = [];
var unsoldTokensReward;
var tokenManager;
var multisig;
var multisig2;
var multisig10;
var ethRateChanger;

var initialBalanceCreator = 0;
var initialBalanceBuyer = 0;
var initialBalanceBuyer2 = 0;
var initialMultisigBalance = 0;
var initialMultisig2Balance = 0;
var initialMultisig10Balance = 0;

var mntContractAddress;
var mntContract;

var goldContractAddress;
var goldContract;

var goldmintContractAddress;
var goldmintContract;

var unsoldContractAddress;
var unsoldContract;

var foundersVestingContractAddress;
var foundersVestingContract;

//eval(fs.readFileSync('./test/helpers/misc.js')+'');

var ICO_TOTAL_SELLING_SHOULD_BE = 7000000 * 1000000000000000000;
var FOUNDERS_BALANCE_SHOULD_BE = 2000000 * 1000000000000000000;
var BONUS_SHOULD_BE = 1000000 * 1000000000000000000;
// 9000000000000000000000000
var TOTAL_SUPPLY_SHOULD_BE = new BigNumber(FOUNDERS_BALANCE_SHOULD_BE).plus(new BigNumber(ICO_TOTAL_SELLING_SHOULD_BE));
var TOKENS_PER_ETH = 51428571428571428571;
var TOKENS_PER_ETH_305_USD = 52285714285714285714;
var TOKENS_PER_38 = 1954;
var TOKENS_PER_8 = 411;
var TOKENS_PER_8_305 = 418;
var ONE_HALF_TOKENS_PER_ETH = 77142857142857142856;

/*
// TEST:
var ICO_TOTAL_SELLING_SHOULD_BE = 250 * 1000000000000000000;
var FOUNDERS_BALANCE_SHOULD_BE = 2000000 * 1000000000000000000;
var BONUS_SHOULD_BE = 1000000 * 1000000000000000000;
var TOTAL_SUPPLY_SHOULD_BE = new BigNumber(FOUNDERS_BALANCE_SHOULD_BE).plus(new BigNumber(ICO_TOTAL_SELLING_SHOULD_BE));
var TOKENS_PER_ETH = 51428571428571428571;
var TOKENS_PER_ETH_305_USD = 52285714285714285714;
var TOKENS_PER_38 = ;
var TOKENS_PER_8 = ;
*/

/////////////////////////////////////////////
// 1000 tokens
var ISSUE_EXTERNALLY = 1000 * 1000000000000000;

// recursive
function getMoreVestedTokens(index,maxIndex,cb){
     // 1 - stop recursion?
     if(index>maxIndex){
          return cb(null);
     }

     // 2 - move time one month
     var hours = 24 * 31;
     var seconds = 60 * 60 * hours;

     web3.currentProvider.sendAsync({
          jsonrpc: '2.0', 
          method: 'evm_increaseTime',
          params: [seconds],       
          id: new Date().getTime() 
     }, function(err) {
          if(err)return cb(err);

          var params = {from: creator, gas: 3900000};
          foundersVestingContract.withdrawTokens(params, (err,res)=>{
               if(err)return cb(err);

               // 3 - continue recursion
               getMoreVestedTokens(index + 1,maxIndex,cb);
          });
     });
}

function issue10kOtherCurrency(index,maxIndex,cb){
     // 1 - stop recursion?
     if(index>maxIndex){
          return cb(null);
     }

     var tokens = 10000 * 1000000000000000000; 
     var perEth = TOKENS_PER_ETH;
     var weiCount = (tokens * 1000000000000000000) / TOKENS_PER_ETH;

     // 2 - issue tokens
     var params = {from: tokenManager, gas: 2900000};
     goldmintContract.issueTokensFromOtherCurrency(creator2, weiCount, params, (err,res)=>{
          if(err){
               return cb(err);
          }
          // 3 - continue recursion
          issue10kOtherCurrency(index + 1,maxIndex,cb);
     });
}

describe('Contracts 2 - test MNTP getters and setters', function() {
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
               goldmintTeam = accounts[3];
               creator2 = accounts[4];
               tokenManager = accounts[5];
               unsoldTokensReward = accounts[6];
               ethRateChanger = accounts[7];

               var contractName = ':MNTP';
               getContractAbi(contractName,function(err,abi){
                    ledgerAbi = abi;

                    done();
               });
          });
     });

     after("Deinitialize everything", function(done) {
          done();
     });

     it('should deploy token contract',function(done){
          var data = {};

          deployMntContract(data,function(err){
               assert.equal(err,null);

               deployUnsoldContract(data,function(err){
                    assert.equal(err,null);

                    deployFoundersVestingContract(data,function(err){
                         assert.equal(err,null);

                         deployGoldmintContract(data,function(err){
                              assert.equal(err,null);

                              assert.equal(goldmintContract.multisigs(0),0xcec42e247097c276ad3d7cfd270adbd562da5c61);
                              assert.equal(goldmintContract.multisigs(9),0xF4Ce80097bf1E584822dBcA84f91D5d7d9df0846);

                              multisig = goldmintContract.multisigs(0);
                              multisig2 = goldmintContract.multisigs(1);

                              done();
                         });
                    });
               });
          });
     });

     it('should set Goldmint address to MNTP contract',function(done){
          mntContract.setIcoContractAddress(
               goldmintContractAddress,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    done();
               }
          );
     });

     it('should set Goldmint token address to Unsold contract',function(done){
          unsoldContract.setIcoContractAddress(
               goldmintContractAddress,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    done();
               }
          );
     });

     it('should not set creator if from bad account', function(done){
          mntContract.creator((err,res)=>{
               assert.equal(err,null);
               assert.equal(res,creator);

               var params = {from: buyer, gas: 2900000};
               mntContract.setCreator(creator2, params, (err,res)=>{
                    assert.notEqual(err,null);

                    mntContract.creator((err,res)=>{
                         assert.equal(err,null);
                         assert.equal(res,creator);
                         done();
                    });
               });
          });
     });

     it('should set creator', function(done){
          var params = {from: creator, gas: 2900000};
          mntContract.setCreator(creator2, params, (err,res)=>{
               assert.equal(err,null);
               mntContract.creator((err,res)=>{
                    assert.equal(err,null);
                    assert.equal(res,creator2);
                    done();
               });
          });
     });

     it('should return 0 for total supply', function(done){
          var params = {from: creator2, gas: 2900000};
          mntContract.totalSupply((err,res)=>{
               assert.equal(err, null);
               assert.equal(res.toString(10), 0);
               done();                              
          })
     });

     it('should not change state if not from creator', function(done){
          var params = {from: creator2, gas: 2900000};
          goldmintContract.startICO(params, (err,res)=>{
               assert.notEqual(err, null);
               done();
          });
     });

     it('should change state to ICORunning', function(done){
          var params = {from: creator, gas: 2900000};
          goldmintContract.startICO(params, (err,res)=>{
               assert.equal(err, null);
               goldmintContract.currentState((err,res)=>{
                    assert.equal(err, null);
                    assert.equal(res,1);
                    done();
               });
          });
     });

     it('should change state to ICOPaused', function(done){
          var params = {from: creator, gas: 2900000};
          goldmintContract.pauseICO(params, (err,res)=>{
               assert.equal(err, null);
               goldmintContract.currentState((err,res)=>{
                    assert.equal(err, null);
                    assert.equal(res,2);
                    done();
               });
          });
     });

     it('should not update total supply after ->running->paused', function(done){
          mntContract.totalSupply((err,res)=>{
               assert.equal(err, null);
               assert.equal(res.toString(10), FOUNDERS_BALANCE_SHOULD_BE);
               done();                              
          });
     });

     it('should not issue tokens externally if in wrong state', function(done){
          var params = {from: tokenManager, gas: 2900000};
          goldmintContract.issueTokensExternal(creator2, 1000, params, (err,res)=>{
               assert.notEqual(err, null);
               done();
          });
     });

     it('should change state to ICORunning', function(done){
          goldmintContract.currentState((err,res)=>{
               assert.equal(err,null);
               assert.equal(res,2);

               var params = {from: creator, gas: 2900000};
               goldmintContract.resumeICO(params, (err,res)=>{
                    assert.equal(err, null);

                    goldmintContract.currentState((err,res)=>{
                         assert.equal(err, null);
                         assert.equal(res,1);
                         done();
                    });
               });
          });
     });

     it('should change state to ICOFinished', function(done){
          // check preconditions
          var moved = goldmintContract.icoTokensUnsold();
          assert.equal(moved,0);
          //assert.equal(goldmintContract.restTokensMoved(),false);
          var unsoldBalance = mntContract.balanceOf(unsoldContractAddress);
          assert.equal(unsoldBalance,0);

          var foundersBalance = mntContract.balanceOf(foundersVestingContractAddress);
          assert.equal(foundersBalance.toString(10), FOUNDERS_BALANCE_SHOULD_BE);

          initialMultisigBalance = web3.eth.getBalance(multisig);
          initialMultisig2Balance = web3.eth.getBalance(multisig2);

          // finish
          var params = {from: creator, gas: 2900000};
          goldmintContract.finishICO(params, (err,res)=>{
               assert.equal(err, null);

               goldmintContract.currentState((err,res)=>{
                    assert.equal(err, null);
                    assert.equal(res,3);

                    // check multisig ETH balance
                    var balanceAfter = web3.eth.getBalance(multisig);
                    var balanceAfter2 = web3.eth.getBalance(multisig2);

                    assert.equal(balanceAfter.toString(10),initialMultisigBalance.toString(10));
                    assert.equal(balanceAfter2.toString(10),initialMultisig2Balance.toString(10));

                    done();
               });
          });
     });

     it('should transfer unsold tokens to GoldmintUnsold contract', function(done){
          // check that unsold tokens are transferred to GoldmintUnsold contract
          mntContract.totalSupply((err,res)=>{
               assert.equal(err, null);

               assert.equal(res.toString(10), TOTAL_SUPPLY_SHOULD_BE.toString(10));

               moved = goldmintContract.icoTokensUnsold();
               assert.equal(moved,ICO_TOTAL_SELLING_SHOULD_BE);

               //assert.equal(goldmintContract.restTokensMoved(),true);

               unsoldBalance = mntContract.balanceOf(unsoldContractAddress);
               assert.equal(unsoldBalance,ICO_TOTAL_SELLING_SHOULD_BE);

               done();                              
          });
     });

     it('should NOT change state to ICORunning again', function(done){
          var params = {from: creator, gas: 2900000};
          goldmintContract.startICO(params, (err,res)=>{
               assert.notEqual(err, null);

               goldmintContract.currentState((err,res)=>{
                    assert.equal(err, null);
                    assert.equal(res,3);
                    done();
               });
          });
     });

     it('should not transfer unsold tokens again', function(done){
          // check that unsold tokens are transferred to GoldmintUnsold contract
          mntContract.totalSupply((err,res)=>{
               assert.equal(err, null);
               assert.equal(res.toString(10), TOTAL_SUPPLY_SHOULD_BE.toString(10));

               var moved = goldmintContract.icoTokensUnsold();
               assert.equal(moved,ICO_TOTAL_SELLING_SHOULD_BE);

               //assert.equal(goldmintContract.restTokensMoved(),true);

               var unsoldBalance = mntContract.balanceOf(unsoldContractAddress);
               assert.equal(unsoldBalance,ICO_TOTAL_SELLING_SHOULD_BE);

               done();                              
          });
     });

     it('should not issue tokens if not token manager', function(done){
          var params = {from: creator, gas: 2900000};
          goldmintContract.issueTokensExternal(creator2, 1000, params, (err,res)=>{
               assert.notEqual(err, null);

               done();
          });
     });

     it('should issue tokens externally with issueTokensExternal function to creator', function(done){
          assert.notEqual(typeof mntContract.issueTokens, 'undefined');

          var params = {from: tokenManager, gas: 2900000};
          goldmintContract.issueTokensExternal(creator2, ISSUE_EXTERNALLY, params, (err,res)=>{
               assert.equal(err, null);

               var issuedExt = goldmintContract.issuedExternallyTokens();
               assert.equal(issuedExt,ISSUE_EXTERNALLY);

               mntContract.balanceOf(creator2, (err,res)=>{
                    assert.equal(err, null);
                    assert.equal(res.toString(10),ISSUE_EXTERNALLY);
                    done();
               });
          });
     });

     it('should not update total supply after ->running->paused->running', function(done){
          mntContract.totalSupply((err,res)=>{
               assert.equal(err, null);

               // 9000001000000000000000000
               var one = new BigNumber(TOTAL_SUPPLY_SHOULD_BE);
               var two = new BigNumber(ISSUE_EXTERNALLY);
               var shouldBe = one.plus(two); 

               assert.equal(res.toString(10),shouldBe.toString(10));
               done();                              
          });
     });

     it('should not issue additional tokens if more than max', function(done){
          var params = {from: tokenManager, gas: 2900000};

          // 1 mln
          var additional = 1000000000000000000000000;
          goldmintContract.issueTokensExternal(buyer2, additional, params, (err,res)=>{
               assert.notEqual(err, null);
               done();
          });
     });

     it('should issue additional tokens', function(done){
          var params = {from: tokenManager, gas: 3900000};

          var bonusReward = goldmintContract.BONUS_REWARD();
          var total = BONUS_SHOULD_BE;
          assert.equal(bonusReward,total);

          var ext = goldmintContract.issuedExternallyTokens();
          assert.equal(ext,ISSUE_EXTERNALLY);
          
          // issue more!
          var additional = bonusReward - ext; 
          goldmintContract.issueTokensExternal(buyer2, additional, params, (err,res)=>{
               assert.equal(err, null);

               var ext2 = goldmintContract.issuedExternallyTokens();
               assert.equal(ext2,total);

               mntContract.balanceOf(buyer2, (err,res)=>{
                    //console.log('RES: ');
                    //console.log(res);

                    assert.equal(err, null);
                    assert.equal(res.toString(10),additional);

                    done();
               });
          });
     });

     it('should not get vested founders tokens if no time elapsed', function(done){
          var params = {from: creator, gas: 3900000};
          foundersVestingContract.withdrawTokens(params, (err,res)=>{
               assert.notEqual(err, null);
               done();
          });
     });

     it('should move time 29 days',function(done){
          var hours = 24 * 29;
          var seconds = 60 * 60 * hours;

          web3.currentProvider.sendAsync({
               jsonrpc: '2.0', 
               method: 'evm_increaseTime',
               params: [seconds],       
               id: new Date().getTime() 
          }, function(err) {
               assert.equal(err,null);
               done(err);
          });
     });

     it('should not get vested founders tokens if not enough time elapsed', function(done){
          var params = {from: creator, gas: 3900000};
          foundersVestingContract.withdrawTokens(params, (err,res)=>{
               assert.notEqual(err, null);
               done();
          });
     });

     it('should move time 2 more days',function(done){
          var hours = 24 * 2;
          var seconds = 60 * 60 * hours;

          web3.currentProvider.sendAsync({
               jsonrpc: '2.0', 
               method: 'evm_increaseTime',
               params: [seconds],       
               id: new Date().getTime() 
          }, function(err) {
               assert.equal(err,null);
               done(err);
          });
     });

     it('should not get vested founders tokens if not creator', function(done){
          var params = {from: creator2, gas: 3900000};
          foundersVestingContract.withdrawTokens(params, (err,res)=>{
               assert.notEqual(err, null);
               done();
          });
     });

     it('should get 1/10 vested founders tokens if >30 days elapsed', function(done){
          // check precondition
          var teamBalance = mntContract.balanceOf(goldmintTeam);
          assert.equal(teamBalance.toString(10), 0);

          var foundersBalance = mntContract.balanceOf(foundersVestingContractAddress);
          assert.equal(foundersBalance.toString(10), FOUNDERS_BALANCE_SHOULD_BE);

          var params = {from: creator, gas: 3900000};
          foundersVestingContract.withdrawTokens(params, (err,res)=>{
               assert.equal(err, null);

               // 1/10th
               var mustMove = FOUNDERS_BALANCE_SHOULD_BE / 10;
               var left = mntContract.balanceOf(foundersVestingContractAddress);
               assert.equal(left.toString(10), FOUNDERS_BALANCE_SHOULD_BE - mustMove);

               var teamBalance = mntContract.balanceOf(goldmintTeam);
               assert.equal(teamBalance.toString(10), mustMove);

               done();
          });
     });

     it('should not get vested founders tokens again', function(done){
          var params = {from: creator, gas: 3900000};
          foundersVestingContract.withdrawTokens(params, (err,res)=>{
               assert.notEqual(err, null);

               // Check balances again!
               // 1/10th
               var mustMove = FOUNDERS_BALANCE_SHOULD_BE / 10;
               var left = mntContract.balanceOf(foundersVestingContractAddress);
               assert.equal(left.toString(10), FOUNDERS_BALANCE_SHOULD_BE - mustMove);

               var teamBalance = mntContract.balanceOf(goldmintTeam);
               assert.equal(teamBalance.toString(10), mustMove);
               done();
          });
     });

     it('should move time 31 days',function(done){
          var hours = 24 * 31;
          var seconds = 60 * 60 * hours;

          web3.currentProvider.sendAsync({
               jsonrpc: '2.0', 
               method: 'evm_increaseTime',
               params: [seconds],       
               id: new Date().getTime() 
          }, function(err) {
               assert.equal(err,null);
               done(err);
          });
     });

     it('should get 1/10 vested founders tokens again', function(done){
          var params = {from: creator, gas: 3900000};
          foundersVestingContract.withdrawTokens(params, (err,res)=>{
               assert.equal(err, null);

               // Check balances again!
               // 2/10th
               var mustMove = 2 * (FOUNDERS_BALANCE_SHOULD_BE / 10);
               var left = mntContract.balanceOf(foundersVestingContractAddress);
               assert.equal(left.toString(10), FOUNDERS_BALANCE_SHOULD_BE - mustMove);

               var teamBalance = mntContract.balanceOf(goldmintTeam);
               assert.equal(teamBalance.toString(10), mustMove);
               done();
          });
     });

     it('should not get vested founders tokens if not enough time elapsed', function(done){
          var params = {from: creator, gas: 3900000};
          foundersVestingContract.withdrawTokens(params, (err,res)=>{
               assert.notEqual(err, null);
               done();
          });
     });

     it('should get vested tokens in a loop', function(done){
          var index = 3;
          var maxIndex = 10;
          getMoreVestedTokens(index,maxIndex,function(err){
               assert.equal(err,null);

               // Check final balances
               var left = mntContract.balanceOf(foundersVestingContractAddress);
               assert.equal(left.toString(10), 0);

               var mustMove = FOUNDERS_BALANCE_SHOULD_BE;
               var teamBalance = mntContract.balanceOf(goldmintTeam);
               assert.equal(teamBalance.toString(10), mustMove);

               done();
          });
     });

     it('should not get vested tokens again!', function(done){
          var index = 0;
          var maxIndex = 0;
          getMoreVestedTokens(index,maxIndex,function(err){
               assert.notEqual(err,null);

               // Final balances should not be changed
               var left = mntContract.balanceOf(foundersVestingContractAddress);
               assert.equal(left.toString(10), 0);

               var mustMove = FOUNDERS_BALANCE_SHOULD_BE;
               var teamBalance = mntContract.balanceOf(goldmintTeam);
               assert.equal(teamBalance.toString(10), mustMove);

               done();
          });
     });
})

describe('Contracts 3 - ICO buy tests', function() {
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
               goldmintTeam = accounts[3];
               creator2 = accounts[4];
               tokenManager = accounts[5];
               unsoldTokensReward = accounts[6];
               ethRateChanger = accounts[7];

               var contractName = ':MNTP';
               getContractAbi(contractName,function(err,abi){
                    ledgerAbi = abi;

                    done();
               });
          });
     });

     after("Deinitialize everything", function(done) {
          done();
     });

     it('should deploy token contract',function(done){
          var data = {};

          deployMntContract(data,function(err){
               assert.equal(err,null);

               deployUnsoldContract(data,function(err){
                    assert.equal(err,null);

                    deployFoundersVestingContract(data,function(err){
                         assert.equal(err,null);

                         deployGoldmintContract(data,function(err){
                              assert.equal(err,null);

                              multisig = goldmintContract.multisigs(0);
                              multisig2 = goldmintContract.multisigs(1);

                              initialMultisigBalance = web3.eth.getBalance(multisig);
                              initialMultisig2Balance = web3.eth.getBalance(multisig2);

                              done();
                         });
                    });
               });
          });
     });

     it('should set Goldmint token address to MNTP contract',function(done){
          mntContract.setIcoContractAddress(
               goldmintContractAddress,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    done();
               }
          );
     });

     it('should set Goldmint token address to Unsold contract',function(done){
          unsoldContract.setIcoContractAddress(
               goldmintContractAddress,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    done();
               }
          );
     });

     it('should get all frontend data', function(done){
          goldmintContract.icoTokensSold((err,res)=>{
               assert.equal(err,null);
               assert.equal(res,0);

               goldmintContract.getTotalIcoTokens((err,res)=>{
                    assert.equal(err,null);
                    assert.equal(res,ICO_TOTAL_SELLING_SHOULD_BE);

                    goldmintContract.getCurrentPrice((err,res)=>{
                         assert.equal(err,null);
                         assert.equal(res,TOKENS_PER_ETH);

                         done();
                    });
               });
          });
     });

     it('should change state to ICORunning', function(done){
          var params = {from: creator, gas: 2900000};
          goldmintContract.startICO(params, (err,res)=>{
               assert.equal(err, null);
               goldmintContract.currentState((err,res)=>{
                    assert.equal(err, null);
                    assert.equal(res,1);
                    done();
               });
          });
     });

     it('should buy tokens 1',function(done){
          // 1 ETH
          var amount = 1000000000000000000;

          web3.eth.sendTransaction(
               {
                    from: buyer,               
                    to: goldmintContractAddress,
                    value: amount,
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    // 51.43 MNTP tokens per 1 ETH
                    var balance = mntContract.balanceOf(buyer);
                    assert.equal(balance,TOKENS_PER_ETH);

                    // new check
                    goldmintContract.icoTokensSold((err,res)=>{
                         assert.equal(err,null);
                         assert.equal(res,TOKENS_PER_ETH);

                         done();
                    });
               }
          );
     });

     it('should change state to ICOFinished', function(done){
          // check preconditions
          var moved = goldmintContract.icoTokensUnsold();
          assert.equal(moved,0);
          //assert.equal(goldmintContract.restTokensMoved(),false);
          var unsoldBalance = mntContract.balanceOf(unsoldContractAddress);
          assert.equal(unsoldBalance,0);

          // finish
          var params = {from: creator, gas: 2900000};
          goldmintContract.finishICO(params, (err,res)=>{
               assert.equal(err, null);

               goldmintContract.currentState((err,res)=>{
                    assert.equal(err, null);
                    assert.equal(res,3);

                    // check multisig ETH balance
                    var balanceAfter = web3.eth.getBalance(multisig);
                    var balance2After = web3.eth.getBalance(multisig2);

                    // All collected ETH should be split between these two multisig wallets
                    var shouldBe = (1000000000000000000 / 10); 
                    var shouldBe2 = (1000000000000000000 / 10); 

                    assert.equal(balanceAfter.toString(10),
                                 parseInt(initialMultisigBalance.toString(10)) + shouldBe);

                    assert.equal(balance2After.toString(10),
                                 parseInt(initialMultisig2Balance.toString(10)) + shouldBe2);

                    done();
               });
          });
     });

     it('should not buy tokens in ICOFinsihed state',function(done){
          // 0.5 ETH
          var amount = 500000000000000000;

          web3.eth.sendTransaction(
               {
                    from: buyer,               
                    to: goldmintContractAddress,
                    value: amount,
                    gas: 2900000 
               },function(err,result){
                    assert.notEqual(err,null);
                    done();
               }
          );
     });

     it('should transfer unsold tokens to GoldmintUnsold contract', function(done){
          // check that unsold tokens are transferred to GoldmintUnsold contract
          mntContract.totalSupply((err,res)=>{
               assert.equal(err, null);
               assert.equal(res.toString(10), TOTAL_SUPPLY_SHOULD_BE.toString(10));

               moved = goldmintContract.icoTokensUnsold();

               //var one = new BigNumber(ICO_TOTAL_SELLING_SHOULD_BE);
               // this doesnt work(((((
               //var two = new BigNumber(TOKENS_PER_ETH);
               //var shouldBe = one.minus(two); 
               //assert.equal(moved,shouldBe);

               // TODO: not working with different params than default!
               assert.equal(moved,ICO_TOTAL_SELLING_SHOULD_BE - TOKENS_PER_ETH);

               //assert.equal(goldmintContract.restTokensMoved(),true);

               unsoldBalance = mntContract.balanceOf(unsoldContractAddress);
               assert.equal(unsoldBalance.toString(10),moved.toString(10));

               done();                              
          });
     });

     it('should not withdraw unsold tokens if time hasnt come', function(done){
          var params = {from: creator, gas: 2900000};

          unsoldContract.withdrawTokens(params,(err,res)=>{
               assert.notEqual(err, null);

               var unsoldBalance = mntContract.balanceOf(unsoldContractAddress);

               // TODO: not working with different params than default!
               //assert.equal(unsoldBalance,ICO_TOTAL_SELLING_SHOULD_BE - TOKENS_PER_ETH);

               var transferred = mntContract.balanceOf(unsoldTokensReward);
               assert.equal(transferred,0);

               done();              
          });
     });

     // TODO: test -> move time in 1 year!
     /*
     it('should not withdraw unsold tokens if time hasnt passed', function(done){
          var params = {from: creator, gas: 2900000};

          unsoldContract.withdrawTokens(params,(err,res)=>{
               assert.notEqual(err, null);

               var unsoldBalance = mntContract.balanceOf(unsoldContractAddress);
               assert.equal(unsoldBalance,ICO_TOTAL_SELLING_SHOULD_BE - 37962962962962962962);

               var transferred = mntContract.balanceOf(unsoldTokensReward);
               assert.equal(transferred,0);

               done();              
          });
     });
     */
})

describe('Contracts 4 - lock MNTP transfers', function() {
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
               goldmintTeam = accounts[3];
               creator2 = accounts[4];
               tokenManager = accounts[5];
               unsoldTokensReward = accounts[6];
               ethRateChanger = accounts[7];

               var contractName = ':MNTP';
               getContractAbi(contractName,function(err,abi){
                    ledgerAbi = abi;

                    done();
               });
          });
     });

     after("Deinitialize everything", function(done) {
          done();
     });

     it('should deploy token contract',function(done){
          var data = {};

          deployMntContract(data,function(err){
               assert.equal(err,null);

               deployUnsoldContract(data,function(err){
                    assert.equal(err,null);

                    deployFoundersVestingContract(data,function(err){
                         assert.equal(err,null);

                         deployGoldmintContract(data,function(err){
                              assert.equal(err,null);

                              multisig = goldmintContract.multisigs(0);
                              multisig2 = goldmintContract.multisigs(1);

                              done();
                         });
                    });
               });
          });
     });

     it('should set Goldmint token address to MNTP contract',function(done){
          mntContract.setIcoContractAddress(
               goldmintContractAddress,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    done();
               }
          );
     });

     it('should set Goldmint token address to Unsold contract',function(done){
          unsoldContract.setIcoContractAddress(
               goldmintContractAddress,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    done();
               }
          );
     });

     it('should change state to ICORunning', function(done){
          var params = {from: creator, gas: 2900000};
          goldmintContract.startICO(params, (err,res)=>{
               assert.equal(err, null);
               goldmintContract.currentState((err,res)=>{
                    assert.equal(err, null);
                    assert.equal(res,1);
                    done();
               });
          });
     });

     it('should buy tokens 1',function(done){
          // 1 ETH
          var amount = 1000000000000000000;

          web3.eth.sendTransaction(
               {
                    from: buyer,               
                    to: goldmintContractAddress,
                    value: amount,
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    // 53.5 MNTP tokens per 1 ETH
                    var balance = mntContract.balanceOf(buyer);
                    assert.equal(balance,TOKENS_PER_ETH);
                    done();
               }
          );
     });

     it('should not transfer MNTP tokens if ICO is not finished',function(done){
          var params = {from: buyer, gas: 2900000};

          var balance1 = mntContract.balanceOf(buyer2);
          assert.equal(balance1,0);

          //var amount = TOKENS_PER_ETH;
          var amount = 10;
          mntContract.transfer(buyer2, amount, params, (err,res)=>{
               assert.notEqual(err, null);

               var balance = mntContract.balanceOf(buyer);
               assert.equal(balance,TOKENS_PER_ETH);
               
               done();
          });
     });

     it('should not transfer MNTP tokens if ICO is not finished',function(done){
          var params = {from: buyer, gas: 2900000};

          var amount = 10;
          mntContract.transfer(buyer2, amount, params, (err,res)=>{
               assert.notEqual(err, null);
               done();
          });
     });

     it('should change state to ICOFinished', function(done){
          // finish
          var params = {from: creator, gas: 2900000};
          goldmintContract.finishICO(params, (err,res)=>{
               assert.equal(err, null);

               goldmintContract.currentState((err,res)=>{
                    assert.equal(err, null);
                    assert.equal(res,3);
                    done();
               });
          });
     });

     it('should transfer MNTP tokens if ICO is finished',function(done){
          var params = {from: buyer, gas: 2900000};

          var balance = mntContract.balanceOf(buyer);
          assert.equal(balance,TOKENS_PER_ETH);

          var balance1 = mntContract.balanceOf(buyer2);
          assert.equal(balance1,0);

          var amount = 10;
          mntContract.transfer(buyer2, amount, params, (err,res)=>{
               assert.equal(err, null);

               balance1 = mntContract.balanceOf(buyer2);
               assert.equal(balance1,amount);
               
               var balanceNew = mntContract.balanceOf(buyer);
               assert.equal(balanceNew,balance - 10);

               done();
          });
     });

     it('should not change state to ICORunning again', function(done){
          var params = {from: creator, gas: 2900000};
          goldmintContract.startICO(params, (err,res)=>{
               assert.notEqual(err, null);

               goldmintContract.currentState((err,res)=>{
                    assert.equal(err, null);
                    assert.equal(res,3);
                    done();
               });
          });
     });

     it('should transfer MNTP tokens if ICO is finished 2',function(done){
          var params = {from: buyer, gas: 2900000};

          var balance = mntContract.balanceOf(buyer);
          var balance1 = mntContract.balanceOf(buyer2);

          // send everything
          var amount = balance;
          mntContract.transfer(buyer2, amount, params, (err,res)=>{
               assert.equal(err, null);

               balance1 = mntContract.balanceOf(buyer2);
               assert.equal(balance1,TOKENS_PER_ETH);
               
               var balanceNew = mntContract.balanceOf(buyer);
               assert.equal(balanceNew,0);

               done();
          });
     });
})


describe('Contracts 5 - test issueTokensFromOtherCurrency', function() {
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
               goldmintTeam = accounts[3];
               creator2 = accounts[4];
               tokenManager = accounts[5];
               unsoldTokensReward = accounts[6];
               ethRateChanger = accounts[7];

               var contractName = ':MNTP';
               getContractAbi(contractName,function(err,abi){
                    ledgerAbi = abi;

                    done();
               });
          });
     });

     after("Deinitialize everything", function(done) {
          done();
     });

     it('should deploy token contract',function(done){
          var data = {};

          deployMntContract(data,function(err){
               assert.equal(err,null);

               deployUnsoldContract(data,function(err){
                    assert.equal(err,null);

                    deployFoundersVestingContract(data,function(err){
                         assert.equal(err,null);

                         deployGoldmintContract(data,function(err){
                              assert.equal(err,null);

                              multisig = goldmintContract.multisigs(0);
                              multisig2 = goldmintContract.multisigs(1);

                              mntContract.setIcoContractAddress(
                                   goldmintContractAddress,
                                   {
                                        from: creator,               
                                        gas: 2900000 
                                   },function(err,result){

                                        unsoldContract.setIcoContractAddress(
                                             goldmintContractAddress,
                                             {
                                                  from: creator,               
                                                  gas: 2900000 
                                             },function(err,result){
                                                  assert.equal(err,null);
                                                  done();
                                        });
                                   });
                         });
                    });
               });
          });
     });

     it('should return 0 for total supply', function(done){
          var params = {from: creator2, gas: 2900000};
          mntContract.totalSupply((err,res)=>{
               assert.equal(err, null);
               assert.equal(res.toString(10), 0);
               done();                              
          })
     });

     it('should not issue tokens if in wrong state', function(done){
          var params = {from: tokenManager, gas: 2900000};

          var amount = 1000000000000000000;
          goldmintContract.issueTokensFromOtherCurrency(creator2, amount, params, (err,res)=>{
               assert.notEqual(err, null);
               done();
          });
     });

     it('should change state to ICORunning', function(done){
          goldmintContract.currentState((err,res)=>{
               assert.equal(err,null);
               assert.equal(res,0);

               var params = {from: creator, gas: 2900000};
               goldmintContract.startICO(params, (err,res)=>{
                    assert.equal(err, null);

                    goldmintContract.currentState((err,res)=>{
                         assert.equal(err, null);
                         assert.equal(res,1);
                         done();
                    });
               });
          });
     });

     it('should not issue tokens from other account', function(done){
          var params = {from: creator, gas: 2900000};

          var amount = 1000000000000000000;
          goldmintContract.issueTokensFromOtherCurrency(creator2, amount, params, (err,res)=>{
               assert.notEqual(err, null);
               done();
          });
     });

     it('should not be able to call issueTokensInternal', function(done){
          var params = {from: creator, gas: 2900000};
          assert.equal(typeof(goldmintContract.issueTokensInternal),'undefined');
          assert.notEqual(typeof(goldmintContract.issueTokensFromOtherCurrency),'undefined');

          done();
     });

     it('should not issue tokens if more than single bucket', function(done){
          var params = {from: tokenManager, gas: 2900000};

          var tokens = 30001 * 1000000000000000000; 
          var perEth = TOKENS_PER_ETH;
          var weiCount = (tokens * 1000000000000000000) / TOKENS_PER_ETH;

          goldmintContract.issueTokensFromOtherCurrency(creator2, weiCount, params, (err,res)=>{
               assert.notEqual(err, null);
               done();
          });
     });

     it('should issue tokens with issueTokensFromOtherCurrency function to creator', function(done){
          var params = {from: tokenManager, gas: 2900000};

          var weiCount = 1000000000000000000;     // 1 ETH
          goldmintContract.issueTokensFromOtherCurrency(creator2, weiCount, params, (err,res)=>{
               assert.equal(err, null);

               var issuedExt = goldmintContract.issuedExternallyTokens();
               assert.equal(issuedExt,0);

               var tokensSold = goldmintContract.icoTokensSold();
               assert.equal(tokensSold,TOKENS_PER_ETH);

               mntContract.balanceOf(creator2, (err,res)=>{
                    assert.equal(err, null);
                    assert.equal(res.toString(10),TOKENS_PER_ETH);
                    done();
               });
          });
     });

     it('should issue tokens with issueTokensFromOtherCurrency function to creator', function(done){
          var params = {from: tokenManager, gas: 2900000};

          // 10 K tokens
          var N = 25000;
          var tokens = N * 1000000000000000000; 
          var perEth = TOKENS_PER_ETH;
          var weiCount = (tokens * 1000000000000000000) / TOKENS_PER_ETH;

          console.log('Wei count: ', weiCount);
          goldmintContract.issueTokensFromOtherCurrency(creator, weiCount, params, (err,res)=>{
               assert.equal(err, null);

               var issuedExt = goldmintContract.issuedExternallyTokens();
               assert.equal(issuedExt,0);

               var tokensSold = goldmintContract.icoTokensSold();
               assert.notEqual(tokensSold,TOKENS_PER_ETH);

               mntContract.balanceOf(creator, (err,res)=>{
                    assert.equal(err, null);
                    assert.equal(res.toString(10),tokens);
                    done();
               });
          });
     });
});

describe('Contracts 6 - ICO finished test', function() {
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
               goldmintTeam = accounts[3];
               creator2 = accounts[4];
               tokenManager = accounts[5];
               unsoldTokensReward = accounts[6];
               ethRateChanger = accounts[7];

               var contractName = ':MNTP';
               getContractAbi(contractName,function(err,abi){
                    ledgerAbi = abi;

                    done();
               });
          });
     });

     after("Deinitialize everything", function(done) {
          done();
     });

     it('should deploy token contract',function(done){
          var data = {};

          deployMntContract(data,function(err){
               assert.equal(err,null);

               deployUnsoldContract(data,function(err){
                    assert.equal(err,null);

                    deployFoundersVestingContract(data,function(err){
                         assert.equal(err,null);

                         deployGoldmintContract(data,function(err){
                              assert.equal(err,null);

                              multisig = goldmintContract.multisigs(0);
                              multisig2 = goldmintContract.multisigs(1);

                              mntContract.setIcoContractAddress(
                                   goldmintContractAddress,
                                   {
                                        from: creator,               
                                        gas: 2900000 
                                   },function(err,result){

                                        unsoldContract.setIcoContractAddress(
                                             goldmintContractAddress,
                                             {
                                                  from: creator,               
                                                  gas: 2900000 
                                             },function(err,result){
                                                  assert.equal(err,null);
                                                  done();
                                        });
                                   });
                         });
                    });
               });
          });
     });

     it('should change state to ICORunning', function(done){
          var params = {from: creator, gas: 2900000};
          goldmintContract.startICO(params, (err,res)=>{
               assert.equal(err, null);
               goldmintContract.currentState((err,res)=>{
                    assert.equal(err, null);
                    assert.equal(res,1);
                    done();
               });
          });
     });

     it('should not change state if not creator', function(done){
          var params = {from: creator2, gas: 2900000};
          goldmintContract.finishICO(params, (err,res)=>{
               assert.notEqual(err, null);

               goldmintContract.currentState((err,res)=>{
                    assert.equal(err, null);
                    assert.equal(res,1);
                    done();
               });
          });
     });
     
     it('should move time 1 month', function(done){
          var hours = 24 * 31;
          var seconds = 60 * 60 * hours;

          web3.currentProvider.sendAsync({
               jsonrpc: '2.0', 
               method: 'evm_increaseTime',
               params: [seconds],       
               id: new Date().getTime() 
          }, function(err) {
               assert.equal(err,null);
               done();
          });
     });

     it('should change state if not creator if ICO is finished', function(done){
          var params = {from: creator2, gas: 2900000};
          goldmintContract.finishICO(params, (err,res)=>{
               assert.equal(err, null);
               goldmintContract.currentState((err,res)=>{
                    assert.equal(err, null);
                    assert.equal(res,3);
                    done();
               });
          });
     });
});

describe('Contracts 7 - Refund', function() {
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
               goldmintTeam = accounts[3];
               creator2 = accounts[4];
               tokenManager = accounts[5];
               unsoldTokensReward = accounts[6];
               ethRateChanger = accounts[7];

               var contractName = ':MNTP';
               getContractAbi(contractName,function(err,abi){
                    ledgerAbi = abi;

                    done();
               });
          });
     });

     after("Deinitialize everything", function(done) {
          done();
     });

     it('should deploy token contract',function(done){
          var data = {};

          deployMntContract(data,function(err){
               assert.equal(err,null);

               deployUnsoldContract(data,function(err){
                    assert.equal(err,null);

                    deployFoundersVestingContract(data,function(err){
                         assert.equal(err,null);

                         deployGoldmintContract(data,function(err){
                              assert.equal(err,null);

                              multisig = goldmintContract.multisigs(0);
                              multisig2 = goldmintContract.multisigs(1);

                              mntContract.setIcoContractAddress(
                                   goldmintContractAddress,
                                   {
                                        from: creator,               
                                        gas: 2900000 
                                   },function(err,result){

                                        unsoldContract.setIcoContractAddress(
                                             goldmintContractAddress,
                                             {
                                                  from: creator,               
                                                  gas: 2900000 
                                             },function(err,result){
                                                  assert.equal(err,null);
                                                  done();
                                        });
                                   });
                         });
                    });
               });
          });
     });

     it('should change state to ICORunning', function(done){
          var params = {from: creator, gas: 2900000};
          goldmintContract.startICO(params, (err,res)=>{
               assert.equal(err, null);
               goldmintContract.currentState((err,res)=>{
                    assert.equal(err, null);
                    assert.equal(res,1);
                    done();
               });
          });
     });

     it('should buy tokens 1',function(done){
          // 1 ETH
          var amount = 1000000000000000000;

          initialBalanceBuyer = web3.eth.getBalance(buyer);

          web3.eth.sendTransaction(
               {
                    from: buyer,               
                    to: goldmintContractAddress,
                    value: amount,
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    // 51.43 MNTP tokens per 1 ETH
                    var balance = mntContract.balanceOf(buyer);
                    assert.equal(balance,TOKENS_PER_ETH);

                    // new check
                    goldmintContract.icoTokensSold((err,res)=>{
                         assert.equal(err,null);
                         assert.equal(res,TOKENS_PER_ETH);

                         done();
                    });
               }
          );
     });

     it('should buy tokens 2',function(done){
          // 0.5 ETH
          var amount = 500000000000000000;

          web3.eth.sendTransaction(
               {
                    from: buyer,               
                    to: goldmintContractAddress,
                    value: amount,
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    var totalBalance = web3.eth.getBalance(goldmintContractAddress);
                    assert.equal(totalBalance,1500000000000000000);

                    var balance = mntContract.balanceOf(buyer);
                    assert.equal(balance,ONE_HALF_TOKENS_PER_ETH);

                    // new check
                    goldmintContract.icoTokensSold((err,res)=>{
                         assert.equal(err,null);
                         assert.equal(res,ONE_HALF_TOKENS_PER_ETH);

                         done();
                    });
               }
          );
     });

     it('should not get money back if not in Refund state',function(done){
          var params = {from: buyer, gas: 2900000};
          goldmintContract.getMyRefund(params, (err,res)=>{
               assert.notEqual(err, null);
               done();
          });
     });

     it('should change state to Refunding', function(done){
          initialMultisigBalance = web3.eth.getBalance(multisig);
          initialMultisig2Balance = web3.eth.getBalance(multisig2);

          var params = {from: creator, gas: 2900000};
          goldmintContract.startRefunding(params, (err,res)=>{
               assert.equal(err, null);
               goldmintContract.currentState((err,res)=>{
                    assert.equal(err, null);
                    assert.equal(res,4);

                    // check multisig ETH balance
                    var balanceAfter = web3.eth.getBalance(multisig);
                    assert.equal(balanceAfter.toString(10),initialMultisigBalance.toString(10));

                    var balance2After = web3.eth.getBalance(multisig2);
                    assert.equal(balance2After.toString(10),initialMultisig2Balance.toString(10));

                    done();
               });
          });
     });
     
     it('should not get money back if nothing bought',function(done){
          var params = {from: creator, gas: 2900000};
          goldmintContract.getMyRefund(params, (err,res)=>{
               assert.notEqual(err, null);
               done();
          });
     });

     it('should get my money back if in Refund state',function(done){
          var params = {from: buyer, gas: 2900000};
          goldmintContract.getMyRefund(params, (err,res)=>{
               assert.equal(err, null);

               var balanceTokens = mntContract.balanceOf(buyer);
               assert.equal(balanceTokens,0);

               var totalBalance = web3.eth.getBalance(goldmintContractAddress);
               assert.equal(totalBalance,0);

               var balanceAfter = web3.eth.getBalance(buyer);

               // the diff is GAS
               // 27499999999818470852
               // 27499999999821560052
               var gasDiff = 100000000
               assert.equal((initialBalanceBuyer - balanceAfter <= gasDiff),true);

               done();
          });
     });
});

describe('Contracts 8 - migrate', function() {
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
               goldmintTeam = accounts[3];
               creator2 = accounts[4];
               tokenManager = accounts[5];
               unsoldTokensReward = accounts[6];
               ethRateChanger = accounts[7];

               var contractName = ':MNTP';
               getContractAbi(contractName,function(err,abi){
                    ledgerAbi = abi;

                    done();
               });
          });
     });

     after("Deinitialize everything", function(done) {
          done();
     });

     it('should deploy token contract',function(done){
          var data = {};

          deployMntContract(data,function(err){
               assert.equal(err,null);

               deployUnsoldContract(data,function(err){
                    assert.equal(err,null);

                    deployFoundersVestingContract(data,function(err){
                         assert.equal(err,null);

                         deployGoldmintContract(data,function(err){
                              assert.equal(err,null);
                              done();
                         });
                    });
               });
          });
     });

     it('should set Goldmint token address to MNTP contract',function(done){
          mntContract.setIcoContractAddress(
               goldmintContractAddress,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    done();
               }
          );
     });

     it('should set Goldmint token address to Unsold contract',function(done){
          unsoldContract.setIcoContractAddress(
               goldmintContractAddress,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    done();
               }
          );
     });

     it('should change state to ICORunning', function(done){
          var params = {from: creator, gas: 2900000};
          goldmintContract.startICO(params, (err,res)=>{
               assert.equal(err, null);
               goldmintContract.currentState((err,res)=>{
                    assert.equal(err, null);
                    assert.equal(res,1);
                    done();
               });
          });
     });

     it('should buy tokens 1',function(done){
          // 1 ETH
          var amount = 1000000000000000000;

          web3.eth.sendTransaction(
               {
                    from: buyer,               
                    to: goldmintContractAddress,
                    value: amount,
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    // 53.5 MNTP tokens per 1 ETH
                    var balance = mntContract.balanceOf(buyer);
                    assert.equal(balance,TOKENS_PER_ETH);
                    done();
               }
          );
     });

     it('should not transfer MNTP tokens if ICO is not finished',function(done){
          var params = {from: buyer, gas: 2900000};

          var balance1 = mntContract.balanceOf(buyer2);
          assert.equal(balance1,0);

          //var amount = TOKENS_PER_ETH;
          var amount = 10;
          mntContract.transfer(buyer2, amount, params, (err,res)=>{
               assert.notEqual(err, null);

               var balance = mntContract.balanceOf(buyer);
               assert.equal(balance,TOKENS_PER_ETH);
               
               done();
          });
     });

     it('should not transfer MNTP tokens if ICO is not finished',function(done){
          var params = {from: buyer, gas: 2900000};

          var amount = 10;
          mntContract.transfer(buyer2, amount, params, (err,res)=>{
               assert.notEqual(err, null);
               done();
          });
     });

     it('should change state to ICOFinished', function(done){
          // finish
          var params = {from: creator, gas: 2900000};
          goldmintContract.finishICO(params, (err,res)=>{
               assert.equal(err, null);

               goldmintContract.currentState((err,res)=>{
                    assert.equal(err, null);
                    assert.equal(res,3);
                    done();
               });
          });
     });

     it('should transfer MNTP tokens if ICO is finished',function(done){
          var params = {from: buyer, gas: 2900000};

          var balance = mntContract.balanceOf(buyer);
          assert.equal(balance,TOKENS_PER_ETH);

          var balance1 = mntContract.balanceOf(buyer2);
          assert.equal(balance1,0);

          var amount = 10;
          mntContract.transfer(buyer2, amount, params, (err,res)=>{
               assert.equal(err, null);

               balance1 = mntContract.balanceOf(buyer2);
               assert.equal(balance1,amount);
               
               var balanceNew = mntContract.balanceOf(buyer);
               assert.equal(balanceNew,balance - 10);

               done();
          });
     });

     it('should change state to Migrating', function(done){
          var params = {from: creator, gas: 2900000};
          goldmintContract.startMigration(params, (err,res)=>{
               assert.equal(err, null);

               goldmintContract.currentState((err,res)=>{
                    assert.equal(err, null);
                    assert.equal(res,5);
                    done();
               });
          });
     });

     it('should not transfer MNTP tokens if in migration state',function(done){
          var params = {from: buyer2, gas: 2900000};

          var balance = mntContract.balanceOf(buyer2);
          assert.equal(balance,10);

          var balance1 = mntContract.balanceOf(buyer);
          assert.equal(balance1,TOKENS_PER_ETH - 10);

          var amount = 10;
          mntContract.transfer(buyer, amount, params, (err,res)=>{
               assert.notEqual(err, null);

               balance1 = mntContract.balanceOf(buyer);
               assert.equal(balance1,TOKENS_PER_ETH - 10);
               
               var balanceNew = mntContract.balanceOf(buyer2);
               assert.equal(balanceNew,10);

               done();
          });
     });
})

describe('Contracts 9 - multisigs check 1', function() {
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
               goldmintTeam = accounts[3];
               creator2 = accounts[4];
               tokenManager = accounts[5];
               unsoldTokensReward = accounts[6];
               ethRateChanger = accounts[7];

               var contractName = ':MNTP';
               getContractAbi(contractName,function(err,abi){
                    ledgerAbi = abi;

                    done();
               });
          });
     });

     after("Deinitialize everything", function(done) {
          done();
     });

     it('should deploy token contract',function(done){
          var data = {};

          deployMntContract(data,function(err){
               assert.equal(err,null);

               deployUnsoldContract(data,function(err){
                    assert.equal(err,null);

                    deployFoundersVestingContract(data,function(err){
                         assert.equal(err,null);

                         deployGoldmintContract(data,function(err){
                              assert.equal(err,null);

                              multisig = goldmintContract.multisigs(0);
                              multisig2 = goldmintContract.multisigs(1);
                              multisig10 = goldmintContract.multisigs(9);

                              initialMultisigBalance = web3.eth.getBalance(multisig);
                              initialMultisig2Balance = web3.eth.getBalance(multisig2);
                              initialMultisig10Balance = web3.eth.getBalance(multisig10);

                              done();
                         });
                    });
               });
          });
     });

     it('should set Goldmint token address to MNTP contract',function(done){
          mntContract.setIcoContractAddress(
               goldmintContractAddress,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    done();
               }
          );
     });

     it('should set Goldmint token address to Unsold contract',function(done){
          unsoldContract.setIcoContractAddress(
               goldmintContractAddress,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    done();
               }
          );
     });

     it('should get all frontend data', function(done){
          goldmintContract.icoTokensSold((err,res)=>{
               assert.equal(err,null);
               assert.equal(res,0);

               goldmintContract.getTotalIcoTokens((err,res)=>{
                    assert.equal(err,null);
                    assert.equal(res,ICO_TOTAL_SELLING_SHOULD_BE);

                    goldmintContract.getCurrentPrice((err,res)=>{
                         assert.equal(err,null);
                         assert.equal(res,TOKENS_PER_ETH);

                         done();
                    });
               });
          });
     });

     it('should change state to ICORunning', function(done){
          var params = {from: creator, gas: 2900000};
          goldmintContract.startICO(params, (err,res)=>{
               assert.equal(err, null);
               goldmintContract.currentState((err,res)=>{
                    assert.equal(err, null);
                    assert.equal(res,1);
                    done();
               });
          });
     });

     it('should buy tokens 1',function(done){
          // will not be enough to split into 10 multisigs proportionally
          var amount = 38;

          web3.eth.sendTransaction(
               {
                    from: buyer,               
                    to: goldmintContractAddress,
                    value: amount,
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    // 51.43 MNTP tokens per 1 ETH
                    var balance = mntContract.balanceOf(buyer);
                    assert.equal(balance,TOKENS_PER_38);

                    // new check
                    goldmintContract.icoTokensSold((err,res)=>{
                         assert.equal(err,null);
                         assert.equal(res,TOKENS_PER_38);

                         done();
                    });
               }
          );
     });

     it('should change state to ICOFinished', function(done){
          // check preconditions
          var moved = goldmintContract.icoTokensUnsold();
          assert.equal(moved,0);
          //assert.equal(goldmintContract.restTokensMoved(),false);
          var unsoldBalance = mntContract.balanceOf(unsoldContractAddress);
          assert.equal(unsoldBalance,0);

          // finish
          var params = {from: creator, gas: 2900000};
          goldmintContract.finishICO(params, (err,res)=>{
               assert.equal(err, null);

               goldmintContract.currentState((err,res)=>{
                    assert.equal(err, null);
                    assert.equal(res,3);

                    // check multisig ETH balance
                    var balanceAfter = web3.eth.getBalance(multisig);
                    var balance2After = web3.eth.getBalance(multisig2);
                    var balance10After = web3.eth.getBalance(multisig10);

                    // All collected ETH should be split between these multisig wallets
                    // 1 - 3
                    // 2 - 3
                    // 3 - 3
                    // 4 - 3
                    // 5 - 3
                    // 6 - 3
                    // 7 - 3
                    // 8 - 3
                    // 9 - 3
                    // 10 - 11
                    var shouldBe = 3;
                    var shouldBe2 = 3;
                    var shouldBe10 = 11;

                    assert.equal(balanceAfter.toString(10),
                                 parseInt(initialMultisigBalance.toString(10)) + shouldBe);

                    assert.equal(balance2After.toString(10),
                                 parseInt(initialMultisig2Balance.toString(10)) + shouldBe2);

                    assert.equal(balance10After.toString(10),
                                 parseInt(initialMultisig10Balance.toString(10)) + shouldBe10);

                    done();
               });
          });
     });
})

describe('Contracts 10 - multisigs check 2', function() {
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
               goldmintTeam = accounts[3];
               creator2 = accounts[4];
               tokenManager = accounts[5];
               unsoldTokensReward = accounts[6];
               ethRateChanger = accounts[7];

               var contractName = ':MNTP';
               getContractAbi(contractName,function(err,abi){
                    ledgerAbi = abi;

                    done();
               });
          });
     });

     after("Deinitialize everything", function(done) {
          done();
     });

     it('should deploy token contract',function(done){
          var data = {};

          deployMntContract(data,function(err){
               assert.equal(err,null);

               deployUnsoldContract(data,function(err){
                    assert.equal(err,null);

                    deployFoundersVestingContract(data,function(err){
                         assert.equal(err,null);

                         deployGoldmintContract(data,function(err){
                              assert.equal(err,null);

                              multisig = goldmintContract.multisigs(0);
                              multisig2 = goldmintContract.multisigs(1);
                              multisig10 = goldmintContract.multisigs(9);

                              initialMultisigBalance = web3.eth.getBalance(multisig);
                              initialMultisig2Balance = web3.eth.getBalance(multisig2);
                              initialMultisig10Balance = web3.eth.getBalance(multisig10);

                              done();
                         });
                    });
               });
          });
     });

     it('should set Goldmint token address to MNTP contract',function(done){
          mntContract.setIcoContractAddress(
               goldmintContractAddress,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    done();
               }
          );
     });

     it('should set Goldmint token address to Unsold contract',function(done){
          unsoldContract.setIcoContractAddress(
               goldmintContractAddress,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    done();
               }
          );
     });

     it('should get all frontend data', function(done){
          goldmintContract.icoTokensSold((err,res)=>{
               assert.equal(err,null);
               assert.equal(res,0);

               goldmintContract.getTotalIcoTokens((err,res)=>{
                    assert.equal(err,null);
                    assert.equal(res,ICO_TOTAL_SELLING_SHOULD_BE);

                    goldmintContract.getCurrentPrice((err,res)=>{
                         assert.equal(err,null);
                         assert.equal(res,TOKENS_PER_ETH);

                         goldmintContract.getTotalCollectedWei((err,res)=>{
                             assert.equal(err,null);
                             assert.equal(res,0);

                             done();
                         });
                    });
               });
          });
     });

     it('should change state to ICORunning', function(done){
          var params = {from: creator, gas: 2900000};
          goldmintContract.startICO(params, (err,res)=>{
               assert.equal(err, null);
               goldmintContract.currentState((err,res)=>{
                    assert.equal(err, null);
                    assert.equal(res,1);
                    done();
               });
          });
     });

     it('should buy tokens 1',function(done){
          var amount = 8;

          web3.eth.sendTransaction(
               {
                    from: buyer,               
                    to: goldmintContractAddress,
                    value: amount,
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    // 51.43 MNTP tokens per 1 ETH
                    var balance = mntContract.balanceOf(buyer);
                    assert.equal(balance,TOKENS_PER_8);

                    // new check
                    goldmintContract.icoTokensSold((err,res)=>{
                         assert.equal(err,null);
                         assert.equal(res,TOKENS_PER_8);

                         done();
                    });
               }
          );
     });

     it('should change state to ICOFinished', function(done){
          // check preconditions
          var moved = goldmintContract.icoTokensUnsold();
          assert.equal(moved,0);
          //assert.equal(goldmintContract.restTokensMoved(),false);
          var unsoldBalance = mntContract.balanceOf(unsoldContractAddress);
          assert.equal(unsoldBalance,0);

          // finish
          var params = {from: creator, gas: 2900000};
          goldmintContract.finishICO(params, (err,res)=>{
               assert.equal(err, null);

               goldmintContract.currentState((err,res)=>{
                    assert.equal(err, null);
                    assert.equal(res,3);

                    // check multisig ETH balance
                    var balanceAfter = web3.eth.getBalance(multisig);
                    var balance2After = web3.eth.getBalance(multisig2);
                    var balance10After = web3.eth.getBalance(multisig10);

                    // All collected ETH should be split between these multisig wallets
                    // 1 - 0 
                    // 2 - 0 
                    // 3 - 0 
                    // 4 - 0 
                    // 5 - 0 
                    // 6 - 0 
                    // 7 - 0 
                    // 8 - 0 
                    // 9 - 0 
                    // 10 - 8 
                    var shouldBe = 0;
                    var shouldBe2 = 0;
                    var shouldBe10 = 8;

                    assert.equal(balanceAfter.toString(10),
                                 parseInt(initialMultisigBalance.toString(10)) + shouldBe);

                    assert.equal(balance2After.toString(10),
                                 parseInt(initialMultisig2Balance.toString(10)) + shouldBe2);

                    assert.equal(balance10After.toString(10),
                                 parseInt(initialMultisig10Balance.toString(10)) + shouldBe10);

                    goldmintContract.getTotalCollectedWei((err,res)=>{
                         assert.equal(err,null);
                         assert.equal(res,8);

                         var ethBalance = web3.eth.getBalance(goldmintContractAddress);
                         assert.equal(ethBalance,0);

                         done();
                    });
               });
          });
     });
})


describe('Contracts 11 - set ETH price ', function() {
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
               goldmintTeam = accounts[3];
               creator2 = accounts[4];
               tokenManager = accounts[5];
               unsoldTokensReward = accounts[6];
               ethRateChanger = accounts[7];

               var contractName = ':MNTP';
               getContractAbi(contractName,function(err,abi){
                    ledgerAbi = abi;

                    done();
               });
          });
     });

     after("Deinitialize everything", function(done) {
          done();
     });

     it('should deploy token contract',function(done){
          var data = {};

          deployMntContract(data,function(err){
               assert.equal(err,null);

               deployUnsoldContract(data,function(err){
                    assert.equal(err,null);

                    deployFoundersVestingContract(data,function(err){
                         assert.equal(err,null);

                         deployGoldmintContract(data,function(err){
                              assert.equal(err,null);

                              multisig = goldmintContract.multisigs(0);
                              multisig2 = goldmintContract.multisigs(1);
                              multisig10 = goldmintContract.multisigs(9);

                              initialMultisigBalance = web3.eth.getBalance(multisig);
                              initialMultisig2Balance = web3.eth.getBalance(multisig2);
                              initialMultisig10Balance = web3.eth.getBalance(multisig10);

                              done();
                         });
                    });
               });
          });
     });

     it('should set Goldmint token address to MNTP contract',function(done){
          mntContract.setIcoContractAddress(
               goldmintContractAddress,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    done();
               }
          );
     });

     it('should set Goldmint token address to Unsold contract',function(done){
          unsoldContract.setIcoContractAddress(
               goldmintContractAddress,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    done();
               }
          );
     });

     it('should get all frontend data', function(done){
          goldmintContract.icoTokensSold((err,res)=>{
               assert.equal(err,null);
               assert.equal(res,0);

               goldmintContract.getTotalIcoTokens((err,res)=>{
                    assert.equal(err,null);
                    assert.equal(res,ICO_TOTAL_SELLING_SHOULD_BE);

                    goldmintContract.getCurrentPrice((err,res)=>{
                         assert.equal(err,null);
                         assert.equal(res,TOKENS_PER_ETH);

                         goldmintContract.getTotalCollectedWei((err,res)=>{
                             assert.equal(err,null);
                             assert.equal(res,0);

                             done();
                         });
                    });
               });
          });
     });

     it('should change state to ICORunning', function(done){
          var params = {from: creator, gas: 2900000};
          goldmintContract.startICO(params, (err,res)=>{
               assert.equal(err, null);
               goldmintContract.currentState((err,res)=>{
                    assert.equal(err, null);
                    assert.equal(res,1);

                    // check initial settings
                    goldmintContract.getCurrentPrice((err,res)=>{
                         assert.equal(err,null);
                         assert.equal(res,TOKENS_PER_ETH);

                         done();
                    });
               });
          });
     });

     it('should buy tokens 1',function(done){
          var amount = 8;

          web3.eth.sendTransaction(
               {
                    from: buyer,               
                    to: goldmintContractAddress,
                    value: amount,
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    // 51.43 MNTP tokens per 1 ETH
                    var balance = mntContract.balanceOf(buyer);
                    assert.equal(balance,TOKENS_PER_8);

                    // new check
                    goldmintContract.icoTokensSold((err,res)=>{
                         assert.equal(err,null);
                         assert.equal(res,TOKENS_PER_8);

                         done();
                    });
               }
          );
     });

     it('should not update price if 8 hours not elapsed', function(done){
          var params = {from: ethRateChanger, gas: 2900000};

          var newRate = 305;
          goldmintContract.setUsdPerEthRate(newRate, params,(err,res)=>{
               assert.notEqual(err, null);

               goldmintContract.getCurrentPrice((err,res)=>{
                    assert.equal(err,null);
                    assert.equal(res,TOKENS_PER_ETH);

                    done();
               });
          });
     });

     // move time 
     it('should move time 2 hours',function(done){
          var hours = 2 * 31;
          var seconds = 60 * 60 * hours;

          web3.currentProvider.sendAsync({
               jsonrpc: '2.0', 
               method: 'evm_increaseTime',
               params: [seconds],       
               id: new Date().getTime() 
          }, function(err) {
               assert.equal(err,null);
               done();
          });
     });

     it('should not update price if from different account', function(done){
          var params = {from: creator, gas: 2900000};

          var newRate = 305;
          goldmintContract.setUsdPerEthRate(newRate, params,(err,res)=>{
               assert.notEqual(err, null);

               goldmintContract.getCurrentPrice((err,res)=>{
                    assert.equal(err,null);
                    assert.equal(res,TOKENS_PER_ETH);

                    done();
               });
          });
     });

     it('should not update price if bad param', function(done){
          var params = {from: ethRateChanger, gas: 2900000};

          var newRate = 99;
          goldmintContract.setUsdPerEthRate(newRate, params,(err,res)=>{
               assert.notEqual(err, null);

               goldmintContract.getCurrentPrice((err,res)=>{
                    assert.equal(err,null);
                    assert.equal(res,TOKENS_PER_ETH);

                    done();
               });
          });
     });

     it('should not update price if bad param', function(done){
          var params = {from: ethRateChanger, gas: 2900000};

          var newRate = 750;
          goldmintContract.setUsdPerEthRate(newRate, params,(err,res)=>{
               assert.notEqual(err, null);

               goldmintContract.getCurrentPrice((err,res)=>{
                    assert.equal(err,null);
                    assert.equal(res,TOKENS_PER_ETH);

                    done();
               });
          });
     });

     it('should update price', function(done){
          var params = {from: ethRateChanger, gas: 2900000};

          var newRate = 305;
          goldmintContract.setUsdPerEthRate(newRate, params,(err,res)=>{
               assert.equal(err, null);

               goldmintContract.getCurrentPrice((err,res)=>{
                    assert.equal(err,null);
                    assert.equal(res,TOKENS_PER_ETH_305_USD);

                    done();
               });
          });
     });

     it('should buy tokens again with different RATE',function(done){
          var amount = 8;

          web3.eth.sendTransaction(
               {
                    from: buyer,               
                    to: goldmintContractAddress,
                    value: amount,
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    var balance = mntContract.balanceOf(buyer);
                    assert.equal(balance,TOKENS_PER_8 + TOKENS_PER_8_305);

                    // new check
                    goldmintContract.icoTokensSold((err,res)=>{
                         assert.equal(err,null);
                         assert.equal(res,TOKENS_PER_8 + TOKENS_PER_8_305);

                         done();
                    });
               }
          );
     });
})

describe('Contracts 12 - test issueTokensFromOtherCurrency total', function() {
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
               goldmintTeam = accounts[3];
               creator2 = accounts[4];
               tokenManager = accounts[5];
               unsoldTokensReward = accounts[6];
               ethRateChanger = accounts[7];

               var contractName = ':MNTP';
               getContractAbi(contractName,function(err,abi){
                    ledgerAbi = abi;

                    done();
               });
          });
     });

     after("Deinitialize everything", function(done) {
          done();
     });

     it('should deploy token contract',function(done){
          var data = {};

          deployMntContract(data,function(err){
               assert.equal(err,null);

               deployUnsoldContract(data,function(err){
                    assert.equal(err,null);

                    deployFoundersVestingContract(data,function(err){
                         assert.equal(err,null);

                         deployGoldmintContract(data,function(err){
                              assert.equal(err,null);

                              multisig = goldmintContract.multisigs(0);
                              multisig2 = goldmintContract.multisigs(1);

                              mntContract.setIcoContractAddress(
                                   goldmintContractAddress,
                                   {
                                        from: creator,               
                                        gas: 2900000 
                                   },function(err,result){

                                        unsoldContract.setIcoContractAddress(
                                             goldmintContractAddress,
                                             {
                                                  from: creator,               
                                                  gas: 2900000 
                                             },function(err,result){
                                                  assert.equal(err,null);
                                                  done();
                                        });
                                   });
                         });
                    });
               });
          });
     });

     it('should return 0 for total supply', function(done){
          var params = {from: creator2, gas: 2900000};
          mntContract.totalSupply((err,res)=>{
               assert.equal(err, null);
               assert.equal(res.toString(10), 0);
               done();                              
          })
     });

     it('should not issue tokens if in wrong state', function(done){
          var params = {from: tokenManager, gas: 2900000};

          var amount = 1000000000000000000;
          goldmintContract.issueTokensFromOtherCurrency(creator2, amount, params, (err,res)=>{
               assert.notEqual(err, null);
               done();
          });
     });

     it('should change state to ICORunning', function(done){
          goldmintContract.currentState((err,res)=>{
               assert.equal(err,null);
               assert.equal(res,0);

               var params = {from: creator, gas: 2900000};
               goldmintContract.startICO(params, (err,res)=>{
                    assert.equal(err, null);

                    goldmintContract.currentState((err,res)=>{
                         assert.equal(err, null);
                         assert.equal(res,1);
                         done();
                    });
               });
          });
     });

     it('should not issue tokens from other account', function(done){
          var params = {from: creator, gas: 2900000};

          var amount = 1000000000000000000;
          goldmintContract.issueTokensFromOtherCurrency(creator2, amount, params, (err,res)=>{
               assert.notEqual(err, null);
               done();
          });
     });

     it('should not be able to call issueTokensInternal', function(done){
          var params = {from: creator, gas: 2900000};
          assert.equal(typeof(goldmintContract.issueTokensInternal),'undefined');
          assert.notEqual(typeof(goldmintContract.issueTokensFromOtherCurrency),'undefined');

          done();
     });

     it('should not issue tokens if more than total ', function(done){
          var index = 0;
          // 299 iterations by default
          var maxIndex = (3000000 / 10000) - 1;     

          // 3 mln = 300 iterations
          issue10kOtherCurrency(index,maxIndex,function(err){
               assert.equal(err,null);

               var issuedOtherCurr = goldmintContract.issuedFromOtherCurrencies(); 

               // should fail!
               issue10kOtherCurrency(index,maxIndex,function(err){
                    assert.notEqual(err,null);
                    done();
               });
          });
     });

});
