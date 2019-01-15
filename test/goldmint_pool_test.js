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


function addAccount(pk, name) {
    accounts.push({pubKey: pk, name: name, initTokenBalance: new BigNumber(0)})
}


describe('GOLDMINT POOL MAIN', function() {

    before("Initialize everything", function(done) {
        web3.eth.getAccounts(function(err, as) {

             if(err) {
                  done(err);
                  return;
             }

             var i = 0;
             as.forEach(a => { addAccount(a, i == 0 ? "creator" : "buyer" + i); i++; });

             creator = as[0];
             buyer1 = as[1];
             buyer2 = as[2];
             buyer3 = as[3];
             buyer4 = as[4];
             buyer5 = as[5];

             newAdmin = as[9];

             done();
        });
    });

    after("Deinitialize everything", function(done) {
            done();
    });   


});