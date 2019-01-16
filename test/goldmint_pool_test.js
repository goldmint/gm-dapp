var solc = require('solc');
var Web3 = require('web3');
var expect = require('chai').expect;

var fs = require('fs');
var assert = require('assert');
var BigNumber = require('bignumber.js');

var web3 = new Web3(new Web3.providers.HttpProvider(process.env.ETH_NODE));

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
var verbose = true;
var distrApprox = 0.000001 * ether;

var buyer1Stake = 8000 * ether;
var buyer2Stake = 2000 * ether;

var bankMntDistributionAmount = 128 * ether;
var bankGoldDistributionAmount = 512 * ether;

eval(fs.readFileSync('./test/helpers/misc.js') + '');

function deploy(done) {
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
}

describe('GOLDMINT POOL MAIN', function () {

	before("Initialize everything", function (done) {
		web3.eth.getAccounts(function (err, as) {
			assert.equal(err, null);

			creator = as[0];
			goldmintTeamAddress = as[1];
			tokenBankAddress = as[2];
			buyer1 = as[3];
			buyer2 = as[4];

			deploy(function () {
				done();
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

		// hold first
		await mntContract.approve(poolContractAddress, buyer1Stake, {
			from: buyer1,
			gas: 2900000
		});
		await poolContract.holdStake(buyer1Stake, {
			from: buyer1,
			gas: 2900000
		});

		// hold second, twice
		await mntContract.approve(poolContractAddress, buyer2Stake, {
			from: buyer2,
			gas: 2900000
		});
		await poolContract.holdStake(buyer2Stake / 2, {
			from: buyer2,
			gas: 2900000
		});
		await poolContract.holdStake(buyer2Stake / 2, {
			from: buyer2,
			gas: 2900000
		});

		// pool got stake
		assert.equal(poolCoreContract.getUserStake(buyer1), buyer1Stake);
		assert.equal(poolCoreContract.getUserStake(buyer2), buyer2Stake);

		// right pool balance
		assert.deepEqual(poolContract.getMntpBalance(), new BigNumber(buyer1Stake + buyer2Stake));
		assert.deepEqual(mntContract.balanceOf(poolContractAddress), poolCoreContract.totalMntpHeld());

		// buyers are drained
		assert.deepEqual(mntContract.balanceOf(buyer1), new BigNumber(0));
		assert.deepEqual(mntContract.balanceOf(buyer2), new BigNumber(0));

		// additional pool balance (should not be paid out, nor unheld)
		await mntContract.issueTokens(poolContractAddress, 100 * ether, {
			from: creator,
			gas: 2900000
		});
		await goldContract.issueTokens(poolContractAddress, 100 * ether, {
			from: creator,
			gas: 2900000
		});

		// shouldn't withdraw now
		try {
			await poolContract.withdrawUserReward({
				from: buyer1,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch {}

		try {
			await poolContract.withdrawUserReward({
				from: buyer2,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch {}
	});

	it('should fill bank and distribute', async() => {

		// fill
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

		// allow distribution
		await mntContract.approve(poolContractAddress, bankMntDistributionAmount, {
			from: tokenBankAddress,
			gas: 2900000
		});
		await goldContract.approve(poolContractAddress, bankGoldDistributionAmount, {
			from: tokenBankAddress,
			gas: 2900000
		});

		// distribute
		await poolContract.distribShareProfit(bankMntDistributionAmount, bankGoldDistributionAmount, {
			from: creator,
			gas: 2900000
		});
	});

	it('should withdraw', async() => {

		// empty accs
		assert.deepEqual(mntContract.balanceOf(buyer1), new BigNumber(0));
		assert.deepEqual(mntContract.balanceOf(buyer2), new BigNumber(0));
		assert.deepEqual(goldContract.balanceOf(buyer1), new BigNumber(0));
		assert.deepEqual(goldContract.balanceOf(buyer2), new BigNumber(0));

		// withdraw
		await poolContract.withdrawUserReward({
			from: buyer1,
			gas: 2900000
		});
		await poolContract.withdrawUserReward({
			from: buyer2,
			gas: 2900000
		});

		// stake
		var buyer1Mult = buyer1Stake / (buyer1Stake + buyer2Stake);
		var buyer2Mult = buyer2Stake / (buyer1Stake + buyer2Stake);

		// check first
		if (verbose)
			console.log(
				"B1:",
				new BigNumber(buyer1Mult.toString()).mul(bankMntDistributionAmount).div(ether).toString(10), "~=", mntContract.balanceOf(buyer1).div(ether).toString(10),
				new BigNumber(buyer1Mult.toString()).mul(bankGoldDistributionAmount).div(ether).toString(10), "~=", goldContract.balanceOf(buyer1).div(ether).toString(10),
			);
		assert(
			new BigNumber(buyer1Mult.toString()).mul(bankMntDistributionAmount).sub(mntContract.balanceOf(buyer1)).abs().lte(distrApprox) &&
			new BigNumber(buyer1Mult.toString()).mul(bankGoldDistributionAmount).sub(goldContract.balanceOf(buyer1)).abs().lte(distrApprox)
		);

		// check second
		if (verbose)
			console.log(
				"B2:",
				new BigNumber(buyer2Mult.toString()).mul(bankMntDistributionAmount).div(ether).toString(10), "~=", mntContract.balanceOf(buyer2).div(ether).toString(10),
				new BigNumber(buyer2Mult.toString()).mul(bankGoldDistributionAmount).div(ether).toString(10), "~=", goldContract.balanceOf(buyer2).div(ether).toString(10),
			);
		assert(
			new BigNumber(buyer2Mult.toString()).mul(bankMntDistributionAmount).sub(mntContract.balanceOf(buyer2)).abs().lte(distrApprox) &&
			new BigNumber(buyer2Mult.toString()).mul(bankGoldDistributionAmount).sub(goldContract.balanceOf(buyer2)).abs().lte(distrApprox)
		);

		// shouldn't withdraw again
		try {
			await poolContract.withdrawUserReward({
				from: buyer1,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch {}

		try {
			await poolContract.withdrawUserReward({
				from: buyer2,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch {}
	});

	it('should unhold', async() => {

		// current users balance
		var buyer1MntBal = mntContract.balanceOf(buyer1);
		var buyer1GoldBal = goldContract.balanceOf(buyer1);
		var buyer2MntBal = mntContract.balanceOf(buyer2);
		var buyer2GoldBal = goldContract.balanceOf(buyer2);

		// unhold
		await poolContract.unholdStake({
			from: buyer1,
			gas: 2900000
		});
		await poolContract.unholdStake({
			from: buyer2,
			gas: 2900000
		});

		// mnt unheld
		assert.deepEqual(buyer1MntBal.add(new BigNumber(buyer1Stake)), mntContract.balanceOf(buyer1));
		assert.deepEqual(buyer2MntBal.add(new BigNumber(buyer2Stake)), mntContract.balanceOf(buyer2));

		// gold didn't change
		assert.deepEqual(buyer1GoldBal, goldContract.balanceOf(buyer1));
		assert.deepEqual(buyer2GoldBal, goldContract.balanceOf(buyer2));

		// pool valud is almost empty
		assert(poolCoreContract.totalMntpHeld().lt(new BigNumber(0.1)));

		// actual pool address balance (remember 100 mnt/gold)
		assert(
			mntContract.balanceOf(poolContractAddress).gte(new BigNumber(100 * ether)) &&
			mntContract.balanceOf(poolContractAddress).lt(new BigNumber(100.1 * ether)) &&
			goldContract.balanceOf(poolContractAddress).gte(new BigNumber(100 * ether)) &&
			goldContract.balanceOf(poolContractAddress).lt(new BigNumber(100.1 * ether)));
	});
});

describe('GOLDMINT POOL W1', function () {

	before("Initialize everything", function (done) {
		web3.eth.getAccounts(function (err, as) {
			assert.equal(err, null);

			creator = as[0];
			goldmintTeamAddress = as[1];
			tokenBankAddress = as[2];
			buyer1 = as[3];
			buyer2 = as[4];

			deploy(function () {
				done();
			});
		});
	});

	after("Deinitialize everything", function (done) {
		done();
	});

	it('should prepare', async() => {
		
		// controller
		await poolCoreContract.setNewControllerAddress(poolContractAddress, {
			from: creator,
			gas: 2900000
		});
		assert.equal(poolCoreContract._controllerAddress(), poolContractAddress);
		
		// fill buyers
		await mntContract.issueTokens(buyer1, buyer1Stake, {
			from: creator,
			gas: 2900000
		});
		await mntContract.issueTokens(buyer2, buyer2Stake, {
			from: creator,
			gas: 2900000
		});
		assert.equal(buyer1Stake, mntContract.balanceOf(buyer1));
		assert.equal(buyer2Stake, mntContract.balanceOf(buyer2));
		
		// fill bank
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
	});
	
	it('should hold user tokens', async() => {
		
		// hold first (half)
		await mntContract.approve(poolContractAddress, buyer1Stake, {
			from: buyer1,
			gas: 2900000
		});
		await poolContract.holdStake(buyer1Stake / 2, {
			from: buyer1,
			gas: 2900000
		});
		assert.equal(poolCoreContract.getUserStake(buyer1), buyer1Stake / 2);

		// hold second
		await mntContract.approve(poolContractAddress, buyer2Stake, {
			from: buyer2,
			gas: 2900000
		});
		await poolContract.holdStake(buyer2Stake, {
			from: buyer2,
			gas: 2900000
		});
		assert.equal(poolCoreContract.getUserStake(buyer2), buyer2Stake);
	});
	
	it('should distribute', async() => {
		
		// allow distribution
		await mntContract.approve(poolContractAddress, bankMntDistributionAmount, {
			from: tokenBankAddress,
			gas: 2900000
		});
		await goldContract.approve(poolContractAddress, bankGoldDistributionAmount, {
			from: tokenBankAddress,
			gas: 2900000
		});
		
		// distribute
		await poolContract.distribShareProfit(bankMntDistributionAmount, bankGoldDistributionAmount, {
			from: creator,
			gas: 2900000
		});
	});
	
	it('should hold user tokens again', async() => {
		
		// hold first
		await poolContract.holdStake(buyer1Stake / 2, {
			from: buyer1,
			gas: 2900000
		});
		assert.equal(poolCoreContract.getUserStake(buyer1), buyer1Stake);

		// buyers are drained
		assert.deepEqual(mntContract.balanceOf(buyer1), new BigNumber(0));
		assert.deepEqual(mntContract.balanceOf(buyer2), new BigNumber(0));
	});
	
	it('should withdraw properly', async() => {
		
		// empty accs
		assert.deepEqual(mntContract.balanceOf(buyer1), new BigNumber(0));
		assert.deepEqual(mntContract.balanceOf(buyer2), new BigNumber(0));
		assert.deepEqual(goldContract.balanceOf(buyer1), new BigNumber(0));
		assert.deepEqual(goldContract.balanceOf(buyer2), new BigNumber(0));

		// withdraw
		await poolContract.withdrawUserReward({
			from: buyer1,
			gas: 2900000
		});
		await poolContract.withdrawUserReward({
			from: buyer2,
			gas: 2900000
		});

		// stake
		var buyer1Mult = buyer1Stake/2 / (buyer1Stake/2 + buyer2Stake);
		var buyer2Mult = buyer2Stake / (buyer1Stake/2 + buyer2Stake);
		
		// check first
		if (verbose)
			console.log(
				"B1:",
				new BigNumber(buyer1Mult.toString()).mul(bankMntDistributionAmount).div(ether).toString(10), "~=", mntContract.balanceOf(buyer1).div(ether).toString(10),
				new BigNumber(buyer1Mult.toString()).mul(bankGoldDistributionAmount).div(ether).toString(10), "~=", goldContract.balanceOf(buyer1).div(ether).toString(10),
			);
		assert(
			new BigNumber(buyer1Mult.toString()).mul(bankMntDistributionAmount).sub(mntContract.balanceOf(buyer1)).abs().lte(distrApprox) &&
			new BigNumber(buyer1Mult.toString()).mul(bankGoldDistributionAmount).sub(goldContract.balanceOf(buyer1)).abs().lte(distrApprox)
		);

		// check second
		if (verbose)
			console.log(
				"B2:",
				new BigNumber(buyer2Mult.toString()).mul(bankMntDistributionAmount).div(ether).toString(10), "~=", mntContract.balanceOf(buyer2).div(ether).toString(10),
				new BigNumber(buyer2Mult.toString()).mul(bankGoldDistributionAmount).div(ether).toString(10), "~=", goldContract.balanceOf(buyer2).div(ether).toString(10),
			);
		assert(
			new BigNumber(buyer2Mult.toString()).mul(bankMntDistributionAmount).sub(mntContract.balanceOf(buyer2)).abs().lte(distrApprox) &&
			new BigNumber(buyer2Mult.toString()).mul(bankGoldDistributionAmount).sub(goldContract.balanceOf(buyer2)).abs().lte(distrApprox)
		);

		// shouldn't withdraw again
		try {
			await poolContract.withdrawUserReward({
				from: buyer1,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch {}

		try {
			await poolContract.withdrawUserReward({
				from: buyer2,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch {}
	});
	
	it('should fill bank and distribute again', async() => {
		
		// fill bank
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

		// allow distribution
		await mntContract.approve(poolContractAddress, bankMntDistributionAmount, {
			from: tokenBankAddress,
			gas: 2900000
		});
		await goldContract.approve(poolContractAddress, bankGoldDistributionAmount, {
			from: tokenBankAddress,
			gas: 2900000
		});
		
		// distribute
		await poolContract.distribShareProfit(bankMntDistributionAmount, bankGoldDistributionAmount, {
			from: creator,
			gas: 2900000
		});
	});
	
	it('should withdraw properly again', async() => {
		
		// current users balance
		var buyer1MntBal = mntContract.balanceOf(buyer1);
		var buyer1GoldBal = goldContract.balanceOf(buyer1);
		var buyer2MntBal = mntContract.balanceOf(buyer2);
		var buyer2GoldBal = goldContract.balanceOf(buyer2);
		
		// withdraw
		await poolContract.withdrawUserReward({
			from: buyer1,
			gas: 2900000
		});
		await poolContract.withdrawUserReward({
			from: buyer2,
			gas: 2900000
		});

		// stake
		var buyer1Mult = buyer1Stake / (buyer1Stake + buyer2Stake);
		var buyer2Mult = buyer2Stake / (buyer1Stake + buyer2Stake);
		
		// check first
		if (verbose)
			console.log(
				"B1:",
				new BigNumber(buyer1Mult.toString()).mul(bankMntDistributionAmount).div(ether).toString(10), "~=", mntContract.balanceOf(buyer1).sub(buyer1MntBal).div(ether).toString(10),
				new BigNumber(buyer1Mult.toString()).mul(bankGoldDistributionAmount).div(ether).toString(10), "~=", goldContract.balanceOf(buyer1).sub(buyer1GoldBal).div(ether).toString(10),
			);
		assert(
			new BigNumber(buyer1Mult.toString()).mul(bankMntDistributionAmount).sub(mntContract.balanceOf(buyer1).sub(buyer1MntBal)).abs().lte(distrApprox) &&
			new BigNumber(buyer1Mult.toString()).mul(bankGoldDistributionAmount).sub(goldContract.balanceOf(buyer1).sub(buyer1GoldBal)).abs().lte(distrApprox)
		);

		// check second
		if (verbose)
			console.log(
				"B2:",
				new BigNumber(buyer2Mult.toString()).mul(bankMntDistributionAmount).div(ether).toString(10), "~=", mntContract.balanceOf(buyer2).sub(buyer2MntBal).div(ether).toString(10),
				new BigNumber(buyer2Mult.toString()).mul(bankGoldDistributionAmount).div(ether).toString(10), "~=", goldContract.balanceOf(buyer2).sub(buyer2GoldBal).div(ether).toString(10),
			);
		assert(
			new BigNumber(buyer2Mult.toString()).mul(bankMntDistributionAmount).sub(mntContract.balanceOf(buyer2).sub(buyer1MntBal)).abs().lte(distrApprox) &&
			new BigNumber(buyer2Mult.toString()).mul(bankGoldDistributionAmount).sub(goldContract.balanceOf(buyer2).sub(buyer2GoldBal)).abs().lte(distrApprox)
		);

		// shouldn't withdraw again
		try {
			await poolContract.withdrawUserReward({
				from: buyer1,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch {}

		try {
			await poolContract.withdrawUserReward({
				from: buyer2,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch {}
	});
});


// TODO:
describe('GOLDMINT POOL MIGRATION', function () {

	before("Initialize everything", function (done) {
		web3.eth.getAccounts(function (err, as) {
			assert.equal(err, null);

			creator = as[0];
			goldmintTeamAddress = as[1];
			tokenBankAddress = as[2];
			buyer1 = as[3];
			buyer2 = as[4];

			deploy(function () {
				done();
			});
		});
	});

	after("Deinitialize everything", function (done) {
		done();
	});

	it('should ', async() => {});
});
