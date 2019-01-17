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
var verbose = false;
var distrApprox = 0.000001 * ether;

var buyer1Stake = 8000 * ether;
var buyer2Stake = 2000 * ether;

var bankMntDistributionAmount = 100 * ether; //128 * ether;
var bankGoldDistributionAmount = 1000 * ether; //512 * ether;

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

	it('should set core controller', async () => {
		await poolCoreContract.setNewControllerAddress(poolContractAddress, {
			from: creator,
			gas: 2900000
		});
		assert.equal(poolCoreContract.controllerAddress(), poolContractAddress);
	});

	it('should issue tokens', async () => {

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

	it('should hold user tokens', async () => {

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
		} catch { }

		try {
			await poolContract.withdrawUserReward({
				from: buyer2,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch { }
	});

	it('should fill bank and distribute', async () => {

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

	it('should withdraw', async () => {

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
		} catch { }

		try {
			await poolContract.withdrawUserReward({
				from: buyer2,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch { }
	});

	it('should unhold', async () => {

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
		assert.deepEqual(poolCoreContract.totalMntpHeld(), new BigNumber(0));

		// actual pool address balance (remember 100 mnt/gold)
		assert(
			mntContract.balanceOf(poolContractAddress).gte(new BigNumber(100 * ether)) &&
			mntContract.balanceOf(poolContractAddress).lt(new BigNumber(100 * ether + distrApprox)) &&
			goldContract.balanceOf(poolContractAddress).gte(new BigNumber(100 * ether)) &&
			goldContract.balanceOf(poolContractAddress).lt(new BigNumber(100 * ether  + distrApprox))
		);
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

	it('should prepare and hold tokens', async () => {

		// controller
		await poolCoreContract.setNewControllerAddress(poolContractAddress, {
			from: creator,
			gas: 2900000
		});
		assert.equal(poolCoreContract.controllerAddress(), poolContractAddress);

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

		// hold first
		await mntContract.approve(poolContractAddress, buyer1Stake, {
			from: buyer1,
			gas: 2900000
		});
		await poolContract.holdStake(buyer1Stake, {
			from: buyer1,
			gas: 2900000
		});
		assert.equal(poolCoreContract.getUserStake(buyer1), buyer1Stake);

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

	it('should distribute and withdraw multiple times', async () => {

		for (var c = 0; c < 2; c++) {
			
			if (verbose) {
				console.log("Distribution", "#"+c);
			}

			// pool has stake
			assert.deepEqual(poolCoreContract.getUserStake(buyer1), new BigNumber(buyer1Stake));
			assert.deepEqual(poolCoreContract.getUserStake(buyer2), new BigNumber(buyer2Stake));
			assert.deepEqual(poolCoreContract.totalMntpHeld(), new BigNumber(buyer1Stake).add(new BigNumber(buyer2Stake)));

			// fill bank
			await mntContract.issueTokens(tokenBankAddress, bankMntDistributionAmount, {
				from: creator,
				gas: 2900000
			});
			await goldContract.issueTokens(tokenBankAddress, bankGoldDistributionAmount, {
				from: creator,
				gas: 2900000
			});
			assert.deepEqual(new BigNumber(bankMntDistributionAmount), mntContract.balanceOf(tokenBankAddress));
			assert.deepEqual(new BigNumber(bankGoldDistributionAmount), goldContract.balanceOf(tokenBankAddress));

			// allow bank draining
			await mntContract.approve(poolContractAddress, bankMntDistributionAmount, {
				from: tokenBankAddress,
				gas: 2900000
			});
			await goldContract.approve(poolContractAddress, bankGoldDistributionAmount, {
				from: tokenBankAddress,
				gas: 2900000
			});

			var prevPoolBal = {
				mnt: mntContract.balanceOf(poolContractAddress),
				gold: goldContract.balanceOf(poolContractAddress),
			};

			// distribute
			await poolContract.distribShareProfit(bankMntDistributionAmount, bankGoldDistributionAmount, {
				from: creator,
				gas: 2900000
			});

			// pool is refilled
			assert.deepEqual(
				mntContract.balanceOf(poolContractAddress).sub(prevPoolBal.mnt),
				new BigNumber(bankMntDistributionAmount)
			);
			assert.deepEqual(
				goldContract.balanceOf(poolContractAddress).sub(prevPoolBal.gold),
				new BigNumber(bankGoldDistributionAmount)
			);

			// stakes
			var stakes = [
				new BigNumber(buyer1Stake).div(new BigNumber(buyer1Stake + buyer2Stake)),
				new BigNumber(buyer2Stake).div(new BigNumber(buyer1Stake + buyer2Stake))
			];

			// expected reward
			var expectedReward  = [
				{ mnt: stakes[0].mul(bankMntDistributionAmount), gold: stakes[0].mul(bankGoldDistributionAmount) },
				{ mnt: stakes[1].mul(bankMntDistributionAmount), gold: stakes[1].mul(bankGoldDistributionAmount) },
			];
			if (verbose) {
				expectedReward.forEach((v, i) => {
					console.log("B"+i, "expected:", v.mnt.div(ether).toString(10), "MNT", "|", v.gold.div(ether).toString(10), "GOLD", "|", "stake", stakes[i].toString());	
				});
			}

			// contract reward
			var actualReward  = [
				{ mnt: poolCoreContract.getMntpTokenUserReward(buyer1)[0], gold: poolCoreContract.getGoldTokenUserReward(buyer1)[0] },
				{ mnt: poolCoreContract.getMntpTokenUserReward(buyer2)[0], gold: poolCoreContract.getGoldTokenUserReward(buyer2)[0] },
			];

			// compare expected/actual
			actualReward.forEach((v, i) => {
				if (verbose) {
					console.log("B"+i, "actual:", v.mnt.div(ether).toString(10), "MNT", "|", v.gold.div(ether).toString(10), "GOLD");	
				}
				assert(equalApprox(v.mnt, expectedReward[i].mnt));
				assert(equalApprox(v.gold, expectedReward[i].gold));
			});

			// current user balance
			var prevBuyerBalance = [
				{ mnt: mntContract.balanceOf(buyer1), gold: goldContract.balanceOf(buyer1), mntPayout: poolCoreContract.getUserMntpRewardPayouts(buyer1), goldPayout: poolCoreContract.getUserGoldRewardPayouts(buyer1) },
				{ mnt: mntContract.balanceOf(buyer2), gold: goldContract.balanceOf(buyer2), mntPayout: poolCoreContract.getUserMntpRewardPayouts(buyer2), goldPayout: poolCoreContract.getUserGoldRewardPayouts(buyer2) }
			];

			// current pool balance
			var prevPoolBal = {
				mnt: mntContract.balanceOf(poolContractAddress),
				gold: goldContract.balanceOf(poolContractAddress),
			};

			// withdraw
			await poolContract.withdrawUserReward({
				from: buyer1,
				gas: 2900000
			});
			await poolContract.withdrawUserReward({
				from: buyer2,
				gas: 2900000
			});

			// check mnt actual reward
			assert.deepEqual(mntContract.balanceOf(buyer1), prevBuyerBalance[0].mnt.add(actualReward[0].mnt));
			assert.deepEqual(mntContract.balanceOf(buyer2), prevBuyerBalance[1].mnt.add(actualReward[1].mnt));

			// check gold actual reward
			assert.deepEqual(goldContract.balanceOf(buyer1), prevBuyerBalance[0].gold.add(actualReward[0].gold));
			assert.deepEqual(goldContract.balanceOf(buyer2), prevBuyerBalance[1].gold.add(actualReward[1].gold));

			// check pool balance drained
			assert.deepEqual(mntContract.balanceOf(poolContractAddress), prevPoolBal.mnt.sub(actualReward[0].mnt).sub(actualReward[1].mnt));
			assert.deepEqual(goldContract.balanceOf(poolContractAddress), prevPoolBal.gold.sub(actualReward[0].gold).sub(actualReward[1].gold));

			// payouts changed
			assert(prevBuyerBalance[0].mntPayout.lt(poolCoreContract.getUserMntpRewardPayouts(buyer1)));
			assert(prevBuyerBalance[0].goldPayout.lt(poolCoreContract.getUserGoldRewardPayouts(buyer1)));
			assert(prevBuyerBalance[1].mntPayout.lt(poolCoreContract.getUserMntpRewardPayouts(buyer2)));
			assert(prevBuyerBalance[1].goldPayout.lt(poolCoreContract.getUserGoldRewardPayouts(buyer2)));

			// new actual reward should be 0
			actualReward  = [
				{ mnt: poolCoreContract.getMntpTokenUserReward(buyer1)[0], gold: poolCoreContract.getGoldTokenUserReward(buyer1)[0] },
				{ mnt: poolCoreContract.getMntpTokenUserReward(buyer2)[0], gold: poolCoreContract.getGoldTokenUserReward(buyer2)[0] },
			];
			actualReward.forEach((v, i) => {
				assert.deepEqual(v.mnt, new BigNumber(0));
				assert.deepEqual(v.gold, new BigNumber(0));
			});

			// shouldn't withdraw again
			try {
				await poolContract.withdrawUserReward({
					from: buyer1,
					gas: 2900000
				});
				assert.fail("Should fail");
			} catch { }

			try {
				await poolContract.withdrawUserReward({
					from: buyer2,
					gas: 2900000
				});
				assert.fail("Should fail");
			} catch { }
		}
	});
});

describe('GOLDMINT POOL W2', function () {

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

	it('should prepare', async () => {

		// controller
		await poolCoreContract.setNewControllerAddress(poolContractAddress, {
			from: creator,
			gas: 2900000
		});
		assert.equal(poolCoreContract.controllerAddress(), poolContractAddress);

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

	it('should hold user tokens #0', async () => {

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

	it('should distribute #0', async () => {

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

	it('should hold user tokens #1', async () => {

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

	it('should withdraw #0', async () => {

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
		var buyer1Mult = buyer1Stake / 2 / (buyer1Stake / 2 + buyer2Stake);
		var buyer2Mult = buyer2Stake / (buyer1Stake / 2 + buyer2Stake);

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
		} catch { }

		try {
			await poolContract.withdrawUserReward({
				from: buyer2,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch { }
	});

	it('should fill bank and distribute #1', async () => {

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

	it('should withdraw #1', async () => {

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
			new BigNumber(buyer2Mult.toString()).mul(bankMntDistributionAmount).sub(mntContract.balanceOf(buyer2).sub(buyer2MntBal)).abs().lte(distrApprox) &&
			new BigNumber(buyer2Mult.toString()).mul(bankGoldDistributionAmount).sub(goldContract.balanceOf(buyer2).sub(buyer2GoldBal)).abs().lte(distrApprox)
		);

		// shouldn't withdraw again
		try {
			await poolContract.withdrawUserReward({
				from: buyer1,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch { }

		try {
			await poolContract.withdrawUserReward({
				from: buyer2,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch { }
	});

	it('should unhold #0', async () => {

		// current users balance
		var buyer1MntBal = mntContract.balanceOf(buyer1);
		var buyer1GoldBal = goldContract.balanceOf(buyer1);
		var buyer2MntBal = mntContract.balanceOf(buyer2);
		var buyer2GoldBal = goldContract.balanceOf(buyer2);

		// unhold first
		await poolContract.unholdStake({
			from: buyer1,
			gas: 2900000
		});

		// mnt unheld for buyer1
		assert.deepEqual(buyer1MntBal.add(new BigNumber(buyer1Stake)), mntContract.balanceOf(buyer1));
		assert.deepEqual(buyer2MntBal, mntContract.balanceOf(buyer2));

		// gold didn't change
		assert.deepEqual(buyer1GoldBal, goldContract.balanceOf(buyer1));
		assert.deepEqual(buyer2GoldBal, goldContract.balanceOf(buyer2));

		// pool balance is almost empty
		assert.deepEqual(poolCoreContract.totalMntpHeld(), new BigNumber(buyer2Stake));
	});

	it('should fill bank and distribute #2', async () => {

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

	it('should withdraw #2', async () => {

		// current users balance
		var buyer1MntBal = mntContract.balanceOf(buyer1);
		var buyer1GoldBal = goldContract.balanceOf(buyer1);
		var buyer2MntBal = mntContract.balanceOf(buyer2);
		var buyer2GoldBal = goldContract.balanceOf(buyer2);

		// withdraw
		try {
			await poolContract.withdrawUserReward({
				from: buyer1,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch{}
		await poolContract.withdrawUserReward({
			from: buyer2,
			gas: 2900000
		});

		// stake
		var buyer1Mult = 0;
		var buyer2Mult = 1;

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
			new BigNumber(buyer2Mult.toString()).mul(bankMntDistributionAmount).sub(mntContract.balanceOf(buyer2).sub(buyer2MntBal)).abs().lte(distrApprox) &&
			new BigNumber(buyer2Mult.toString()).mul(bankGoldDistributionAmount).sub(goldContract.balanceOf(buyer2).sub(buyer2GoldBal)).abs().lte(distrApprox)
		);

		// shouldn't withdraw again
		try {
			await poolContract.withdrawUserReward({
				from: buyer1,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch { }

		try {
			await poolContract.withdrawUserReward({
				from: buyer2,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch { }
	});

	it('should unhold #1', async () => {

		// current users balance
		var buyer2MntBal = mntContract.balanceOf(buyer2);
		var buyer2GoldBal = goldContract.balanceOf(buyer2);

		// unhold
		try {
			await poolContract.unholdStake({
				from: buyer1,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch {}

		await poolContract.unholdStake({
			from: buyer2,
			gas: 2900000
		});

		// mnt unheld
		assert.deepEqual(buyer2MntBal.add(new BigNumber(buyer2Stake)), mntContract.balanceOf(buyer2));

		// gold didn't change
		assert.deepEqual(buyer2GoldBal, goldContract.balanceOf(buyer2));

		// pool held amount is almost empty
		assert.deepEqual(poolCoreContract.totalMntpHeld(), new BigNumber(0));

		// actual pool address balance (remember 100 mnt/gold)
		assert(
			mntContract.balanceOf(poolContractAddress).gte(new BigNumber(0 * ether)) &&
			mntContract.balanceOf(poolContractAddress).lt(new BigNumber(distrApprox * ether)) &&
			goldContract.balanceOf(poolContractAddress).gte(new BigNumber(0 * ether)) &&
			goldContract.balanceOf(poolContractAddress).lt(new BigNumber(distrApprox * ether))
		);
	});
});

describe('GOLDMINT POOL MIGRATION', function () {

	var poolContractAddressOld;
	var poolContractOld;

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

	it('should set initial controller', async () => {

		assert.equal(poolCoreContract.controllerAddress(), creator);

		// should fail
		try {
			await poolCoreContract.setNewControllerAddress(poolContractAddress, {
				from: buyer1,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch { }

		// creator set controller only once
		await poolCoreContract.setNewControllerAddress(poolContractAddress, {
			from: creator,
			gas: 2900000
		});
		assert.equal(poolCoreContract.controllerAddress(), poolContractAddress);

		// should fail
		try {
			await poolCoreContract.setNewControllerAddress(poolContractAddress, {
				from: creator,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch { }

		// pool is active
		assert.equal(poolContract.isActive(), true);

		// fill pool with some tokens
		await mntContract.issueTokens(poolContractAddress, 1 * ether, {
			from: creator,
			gas: 2900000
		});
		await goldContract.issueTokens(poolContractAddress, 1 * ether, {
			from: creator,
			gas: 2900000
		});
	});

	it("should deploy new pool", function (done) {

		poolContractAddressOld = poolContractAddress;
		poolContractOld = poolContract;

		var data = {};
		deployGoldmintPoolContract(data, function (err) {
			assert.equal(err, null);

			done();
		});
	});

	it('should set new controller', async () => {

		// flags
		assert.equal(poolContractOld.isActive(), true);
		assert.equal(poolContractOld.isActualContractVer(), true);
		assert.equal(poolContract.isActive(), true);
		assert.equal(poolContract.isActualContractVer(), true);

		// tokens
		assert(poolContractOld.getMntpBalance().gt(0));
		assert(poolContractOld.getGoldBalance().gt(0));
		assert(poolContract.getMntpBalance().eq(0));
		assert(poolContract.getGoldBalance().eq(0));

		// non-admin can't migrate
		try {
			await poolContractOld.migrateToNewNewControllerContract(poolContractAddress, {
				from: buyer1,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch { }

		// migrate
		await poolContractOld.migrateToNewNewControllerContract(poolContractAddress, {
			from: creator,
			gas: 2900000
		});
		assert.equal(poolCoreContract.controllerAddress(), poolContractAddress);

		// flags
		assert.equal(poolContractOld.isActive(), false);
		assert.equal(poolContractOld.isActualContractVer(), false);
		assert.equal(poolContract.isActive(), true);
		assert.equal(poolContract.isActualContractVer(), true);

		// admin can switch activity
		await poolContract.switchActive(poolContractAddress, {
			from: creator,
			gas: 2900000
		});
		assert.equal(poolContract.isActive(), false);
		await poolContract.switchActive(poolContractAddress, {
			from: creator,
			gas: 2900000
		});
		assert.equal(poolContract.isActive(), true);
	});
});

// ---

function equalApprox(a, b) {
	return a.sub(b).abs().lte(distrApprox);
}