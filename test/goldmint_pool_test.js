var solc = require('solc');
var Web3 = require('web3');
var expect = require('chai').expect;

var fs = require('fs');
var assert = require('assert');
var BigNumber = require('bignumber.js');

var web3 = new Web3(new Web3.providers.HttpProvider(process.env.ETH_NODE));

var creator;
var goldmintTeamAddress;
var tokenBankAddress;

var mntContractAddress;
var mntContract;
var goldContractAddress;
var goldContract;
var poolCoreContractAddress;
var poolCoreContract;
var poolContractAddress;
var poolContract;

eval(fs.readFileSync('./test/helpers/misc.js') + '');

describe('GOLDMINT POOL MAIN', function () {

	before("Initialize everything", function (done) {
		web3.eth.getAccounts(function (err, as) {
			if (err) {
				done(err);
				return;
			}

			creator = as[0];
			goldmintTeamAddress = as[1];
			tokenBankAddress = as[2];

			var data = {};

			deployMntContract(data, function (err) {
				assert.equal(err, null);

				deployGoldFeeContract(data, function (err) {
					assert.equal(err, null);

					deployGoldContract(data, function (err) {
						assert.equal(err, null);
						
						deployGoldmintPoolCoreContract(data, function (err) {
							assert.equal(err, null);
							
							deployGoldmintPoolContract(data, function (err) {
								assert.equal(err, null);

								done();
							});
						});
					});
				});
			});
		});
	});

	after("Deinitialize everything", function (done) {
		done();
	});
	
	it('should deploy token contract', function (done) {

		done();
	});
});
