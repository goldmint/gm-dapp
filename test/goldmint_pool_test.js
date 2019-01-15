var solc = require('solc');
var Web3 = require('web3');
var expect = require('chai').expect;

var fs = require('fs');
var assert = require('assert');
var BigNumber = require('bignumber.js');

var web3 = new Web3(new Web3.providers.HttpProvider(process.env.ETH_NODE));

var accounts = new Array();
var creator;
var buyer1;
var buyer2;
var buyer3;
var buyer4;
var buyer5;
var buyer6;


var mntContractAddress;
var mntContract;

var goldContractAddress;
var goldContract;

var poolCoreContractAddress;
var poolCoreContract;

var poolContractAddress;
var poolContract;

var goldmintTeamAddress;
var initialBalanceCreator = 0;
var tokenBankAddress;

function addAccount(pk, name) {
    accounts.push({pubKey: pk, name: name, initTokenBalance: new BigNumber(0)})
}

eval(fs.readFileSync('./test/helpers/misc.js')+'');


describe('GOLDMINT POOL MAIN', function() {

    before("Initialize everything", function(done) {
        web3.eth.getAccounts(function(err, as) {
             if(err) {
                  done(err);
                  return;
             }

             accounts = as;
             creator = accounts[0];
             creator2 = accounts[1];
             buyer = accounts[2];
             goldmintTeamAddress = accounts[3];
             tokenBankAddress = accounts[4];
             var data = {};

             deployMntContract(data,function(err){
              assert.equal(err,null);
              
                      deployGoldFeeContract(data,function(err){
                          assert.equal(err,null);
      
                          deployGoldContract(data,function(err){
                              assert.equal(err,null);
                              deployGoldmintPoolCoreContract(data,function(err){
                                assert.equal(err,null);
                                deployGoldmintPoolContract(data,function(err){
                                    assert.equal(err,null);

                                    done();
                                });
                              });
                          });
                      });
              });
        });
    });

    after("Deinitialize everything", function(done) {
            done();
    });
    it('should deploy token contract',function(done){

        done();
   });
});