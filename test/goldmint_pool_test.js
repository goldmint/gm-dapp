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

var ether = 1000000000000000000;

var buyer1Stake = 8000 * ether;
var buyer2Stake = 2000 * ether;

var bankMntDistributionAmount = 128 * ether;
var bankGoldDistributionAmount = 512 * ether;

eval(fs.readFileSync('./test/helpers/misc.js') + '');

describe('GOLDMINT POOL MAIN', function () {

	before("Initialize everything", function (done) {
		web3.eth.getAccounts(function (err, as) {
			if (err) {
				done(err);
				return;
			}

			accounts = as;
			creator = accounts[0];
			creator2 = accounts[1];
			buyer1 = accounts[2];
			goldmintTeamAddress = accounts[3];
			tokenBankAddress = accounts[4];
			buyer2 = accounts[5];

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

	it('should set core controller', async() => {
		await poolCoreContract.setNewControllerAddress(poolContractAddress, {
			from: creator,
			gas: 2900000
		});
		assert.equal(poolCoreContract._controllerAddress(), poolContractAddress);
	});

	it('should issue tokens', async() => {

		// b1
		await mntContract.issueTokens(buyer1, buyer1Stake, {
			from: creator,
			gas: 2900000
		});
		
		// b2
		await mntContract.issueTokens(buyer2, buyer2Stake, {
			from: creator,
			gas: 2900000
		});

		assert.equal(buyer1Stake, mntContract.balanceOf(buyer1));
		assert.equal(buyer2Stake, mntContract.balanceOf(buyer2));
	});

	it('should hold user tokens', async() => {

		var buyer1HoldTokenAmount = buyer1Stake;
		var buyer2HoldTokenAmount = buyer2Stake;

		// hold b1
		await mntContract.approve(poolContractAddress, buyer1HoldTokenAmount, {
			from: buyer1,
			gas: 2900000
		});
		await poolContract.holdStake(buyer1HoldTokenAmount, {
			from: buyer1,
			gas: 2900000
		});

		// hold b2 twice
		await mntContract.approve(poolContractAddress, buyer2HoldTokenAmount, {
			from: buyer2,
			gas: 2900000
		});
		await poolContract.holdStake(buyer2HoldTokenAmount / 2, {
			from: buyer2,
			gas: 2900000
		});
		await poolContract.holdStake(buyer2HoldTokenAmount / 2, {
			from: buyer2,
			gas: 2900000
		});

		assert.equal(poolCoreContract.getUserStake(buyer1), buyer1HoldTokenAmount);
		assert.equal(poolCoreContract.getUserStake(buyer2), buyer2HoldTokenAmount);
		assert.deepEqual(poolContract.getMntpBalance(), new BigNumber(buyer1HoldTokenAmount + buyer2HoldTokenAmount));
		assert.deepEqual(mntContract.balanceOf(poolContractAddress), poolCoreContract.totalMntpHeld());
		assert.deepEqual(mntContract.balanceOf(buyer1), new BigNumber(0));
		assert.deepEqual(mntContract.balanceOf(buyer2), new BigNumber(0));
		
		// additional pool balance (should not be paid out, nor unheld)
		await mntContract.issueTokens(poolContractAddress, 1 * ether, {
			from: creator,
			gas: 2900000
		});
		await goldContract.issueTokens(poolContractAddress, 1 * ether, {
			from: creator,
			gas: 2900000
		});
	});
	
	it('should fill bank and distribute', async() => {

		await mntContract.issueTokens(tokenBankAddress, bankMntDistributionAmount, {
			from: creator,
			gas: 2900000
		});
		await goldContract.issueTokens(tokenBankAddress, bankGoldDistributionAmount, {
			from: creator,
			gas: 2900000
		});

		assert.equal(bankMntDistributionAmount, mntContract.balanceOf(tokenBankAddress));
		assert.equal(bankGoldDistributionAmount, goldContract.balanceOf(tokenBankAddress));
		
		await mntContract.approve(poolContractAddress, bankMntDistributionAmount, {
			from: tokenBankAddress,
			gas: 2900000
		});
		await goldContract.approve(poolContractAddress, bankGoldDistributionAmount, {
			from: tokenBankAddress,
			gas: 2900000
		});
		
		await poolContract.distribShareProfit(bankMntDistributionAmount, bankGoldDistributionAmount, { from: creator, gas: 2900000});
	});
	
	it('should withdraw', async() => {
		
		assert(mntContract.balanceOf(buyer1).eq(new BigNumber(0)));
		assert(mntContract.balanceOf(buyer2).eq(new BigNumber(0)));
		assert(goldContract.balanceOf(buyer1).eq(new BigNumber(0)));
		assert(goldContract.balanceOf(buyer2).eq(new BigNumber(0)));

		await poolContract.withdrawUserReward({ from: buyer1, gas: 2900000});
		await poolContract.withdrawUserReward({ from: buyer2, gas: 2900000});
		
		var buyer1Mult = buyer1Stake / (buyer1Stake + buyer2Stake);
		var buyer2Mult = buyer2Stake / (buyer1Stake + buyer2Stake);
		
		console.log(
			"D1/B1:", 
			new BigNumber(buyer1Mult * bankMntDistributionAmount).toString(), ">=", mntContract.balanceOf(buyer1).toString(10),
			"&&",
			new BigNumber(buyer1Mult * bankGoldDistributionAmount).toString(), ">=", goldContract.balanceOf(buyer1).toString(10),
		);
		assert(
			new BigNumber(buyer1Mult * bankMntDistributionAmount).gte(mntContract.balanceOf(buyer1)) &&
			new BigNumber(buyer1Mult * bankGoldDistributionAmount).gte(goldContract.balanceOf(buyer1))
		);
		
		console.log(
			"D1/B2:", 
			new BigNumber(buyer2Mult * bankMntDistributionAmount).toString(), ">=", mntContract.balanceOf(buyer2).toString(10),
			"&&",
			new BigNumber(buyer2Mult * bankGoldDistributionAmount).toString(), ">=", goldContract.balanceOf(buyer2).toString(10),
		);
		assert(
			new BigNumber(buyer2Mult * bankMntDistributionAmount).gte(mntContract.balanceOf(buyer2)) &&
			new BigNumber(buyer2Mult * bankGoldDistributionAmount).gte(goldContract.balanceOf(buyer2))
		);
	});
	
	// it('should withdraw both buyers', async() => {

		// // fill bank second time
		// await mntContract.approve(poolContractAddress, bankMntDistributionAmount / 2, {
			// from: tokenBankAddress,
			// gas: 2900000
		// });
		// await goldContract.approve(poolContractAddress, bankGoldDistributionAmount / 2, {
			// from: tokenBankAddress,
			// gas: 2900000
		// });
		// await poolContract.distribShareProfit(bankMntDistributionAmount / 2, bankGoldDistributionAmount / 2, { from: creator, gas: 2900000});
		
		// await poolContract.withdrawUserReward({ from: buyer1, gas: 2900000});
		// await poolContract.withdrawUserReward({ from: buyer2, gas: 2900000});
	// });
});
