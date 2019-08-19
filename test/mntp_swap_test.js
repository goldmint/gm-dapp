var solc = require('solc');
var Web3 = require('web3');
var expect = require('chai').expect;

var fs = require('fs');
var assert = require('assert');
var BigNumber = require('bignumber.js');

var web3 = new Web3(new Web3.providers.HttpProvider(process.env.ETH_NODE));

var creator;
var buyer;
var service;

var mntContractAddress;
var mntContract;

var goldContractAddress;
var goldContract;

var swapCoreContractAddress;
var swapCoreContract;

var swapContractAddress;
var swapContract;

var goldmintTeamAddress;
var initialBalanceCreator = 0;

var ether = 1000000000000000000;

var sumusAddress = new Uint8Array([ 0xDE, 0xAD, 0xBE, 0xEF, 0xDE, 0xAD, 0xBE, 0xEF,  0xDE, 0xAD, 0xBE, 0xEF, 0xDE, 0xAD, 0xBE, 0xEF,  0xDE, 0xAD, 0xBE, 0xEF, 0xDE, 0xAD, 0xBE, 0xEF,  0xDE, 0xAD, 0xBE, 0xEF, 0xDE, 0xAD, 0xBE, 0xEF ]);

eval(fs.readFileSync('./test/helpers/misc.js') + '');

function deploy(done) {
	var data = {};

	deployMntContract(data, function (err) {
		assert.equal(err, null);

		deployGoldFeeContract(data, function (err) {
			assert.equal(err, null);

			deployGoldContract(data, function (err) {
				assert.equal(err, null);

				deployMntpSwapCoreContract(data, function (err) {
					assert.equal(err, null);

					deployMntpSwapContract(data, function (err) {
						assert.equal(err, null);

						done();
					});
				});
			});
		});
	});
}

describe('MNTP SWAP MAIN', function () {

	var oldSwapContractAddress;
	var oldSwapContract;

	before("initialize everything", function (done) {
		web3.eth.getAccounts(function (err, as) {
			assert.equal(err, null);

			creator = as[0];
			goldmintTeamAddress = as[1];
			service = as[2];
			buyer = as[3];

			deploy(function () {
				done();
			});
		});
	});

	after("deinitialize everything", function (done) {
		done();
	});

	it("should set core's controller", async () => {
		await swapCoreContract.setNewControllerAddress(swapContractAddress, {
			from: creator,
			gas: 2900000
		});
		assert.deepEqual(swapCoreContract.controllerAddress(), swapContractAddress);
	});

	it("should set service account", async () => {

		// buyer fail
		try {
			await swapCoreContract.addAdmin(service, {
				from: buyer,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch (e) { }
		try {
			await swapCoreContract.addService(service, {
				from: buyer,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch (e) { }

		// creator
		await swapCoreContract.addService(service, {
			from: creator,
			gas: 2900000
		});

		assert.deepEqual(swapCoreContract.isAdmin(creator), true);
		assert.deepEqual(swapCoreContract.isAdmin(service), false);
		assert.deepEqual(swapCoreContract.isAdmin(buyer), false);
		assert.deepEqual(swapCoreContract.isService(creator), false);
		assert.deepEqual(swapCoreContract.isService(service), true);
		assert.deepEqual(swapCoreContract.isService(buyer), false);
	});

	it("shouldn't toggle activity due to rights", async () => {

		assert.deepEqual(swapContract.isActive(), true);

		// buyer
		try {
			await swapContract.toggleActivity({
				from: buyer,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch (e) { }

		assert.deepEqual(swapContract.isActive(), true);

		// service
		try {
			await swapContract.toggleActivity({
				from: service,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch (e) { }

		assert.deepEqual(swapContract.isActive(), true);
	});

	it("should issue initial mntp", async () => {

		await mntContract.issueTokens(service, 10000 * ether, {
			from: creator,
			gas: 2900000
		});
		assert.deepEqual(mntContract.balanceOf(service), new BigNumber(10000 * ether));

		await mntContract.issueTokens(buyer, 5000 * ether, {
			from: creator,
			gas: 2900000
		});
		assert.deepEqual(mntContract.balanceOf(buyer), new BigNumber(5000 * ether));
	});

	it("shouldn't receive buyer's mntp due to allowance", async () => {

		// allow 100
		await mntContract.approve(swapContractAddress, 100 * ether, {
			from: buyer,
			gas: 2900000
		});

		// swap 5000
		try {
			await swapContract.swapMntp(5000 * ether, {
				from: buyer,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch (e) { }

		// reset allowance
		await mntContract.approve(swapContractAddress, 0, {
			from: buyer,
			gas: 2900000
		});
	});

	it("shouldn't receive buyer's mntp due to inactivity", async () => {

		assert.deepEqual(swapContract.isActive(), true);

		// set inactive
		await swapContract.toggleActivity({
			from: creator,
			gas: 2900000
		});

		assert.deepEqual(swapContract.isActive(), false);

		// allow 5000
		await mntContract.approve(swapContractAddress, 5000 * ether, {
			from: buyer,
			gas: 2900000
		});

		// swap 5000
		try {
			await swapContract.swapMntp(5000 * ether, {
				from: buyer,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch (e) { }

		assert.deepEqual(mntContract.balanceOf(buyer), new BigNumber(5000 * ether));
		assert.deepEqual(swapContract.isActive(), false);

		// set active
		await swapContract.toggleActivity({
			from: creator,
			gas: 2900000
		});

		assert.deepEqual(swapContract.isActive(), true);
		
		// reset allowance
		await mntContract.approve(swapContractAddress, 0, {
			from: buyer,
			gas: 2900000
		});
	});

	it("should receive buyer's 5000 mntp", async () => {

		// allow 5000
		await mntContract.approve(swapContractAddress, 5000 * ether, {
			from: buyer,
			gas: 2900000
		});

		// swap
		await swapContract.swapMntp(5000 * ether, sumusAddress, {
			from: buyer,
			gas: 2900000
		});

		// swap balance
		assert.deepEqual(swapContract.getMntpBalance(), new BigNumber(5000 * ether));
		assert.deepEqual(mntContract.balanceOf(swapContractAddress), new BigNumber(5000 * ether));

		// buyer balance
		assert.deepEqual(mntContract.balanceOf(buyer), new BigNumber(0 * ether));
	});
	
	it("should neither send mntp, nor drain contract", async () => {

		// buyer
		try {
			await swapContract.sendMntp(1000 * ether, buyer, sumusAddress, {
				from: buyer,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch (e) { }
		try {
			await swapContract.drainMntp(buyer, {
				from: buyer,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch (e) { }

		// creator
		try {
			await swapContract.drainMntp(buyer, {
				from: creator,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch (e) { }
	});

	it("should send 2500 mntp to the buyer from service account", async () => {

		// too much
		try {
			await swapContract.sendMntp(25000 * ether, buyer, sumusAddress, {
				from: service,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch (e) { }

		// 2500 mntp to the buyer
		await swapContract.sendMntp(2500 * ether, buyer, sumusAddress, {
			from: service,
			gas: 2900000
		});

		// swap balance
		assert.deepEqual(swapContract.getMntpBalance(), new BigNumber(2500 * ether));
		assert.deepEqual(mntContract.balanceOf(swapContractAddress), new BigNumber(2500 * ether));

		// buyer balance
		assert.deepEqual(mntContract.balanceOf(buyer), new BigNumber(2500 * ether));
	});

	it("should deploy new swap contract", function (done) {

		oldSwapContractAddress = swapContractAddress;
		oldSwapContract = swapContract;

		var data = {};
		deployMntpSwapContract(data, function (err) {
			assert.equal(err, null);
			done();
		});
	});

	it("should migrate to the new contract", async () => {

		// flags
		assert.deepEqual(oldSwapContract.isActive(), true);
		assert.deepEqual(oldSwapContract.isActual(), true);
		assert.deepEqual(swapContract.isActive(), true);
		assert.deepEqual(swapContract.isActual(), true);

		// check balance
		assert.deepEqual(oldSwapContract.getMntpBalance(), new BigNumber(2500 * ether));
		assert.deepEqual(swapContract.getMntpBalance(), new BigNumber(0 * ether));

		// non-admin can't migrate
		try {
			await oldSwapContract.migrateContract(swapContractAddress, {
				from: buyer,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch (e) { }
		try {
			await oldSwapContract.migrateContract(swapContractAddress, {
				from: service,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch (e) { }

		// migrate
		await oldSwapContract.migrateContract(swapContractAddress, {
			from: creator,
			gas: 2900000
		});
		assert.deepEqual(swapCoreContract.controllerAddress(), swapContractAddress);

		// coins migration
		assert.deepEqual(oldSwapContract.getMntpBalance(), new BigNumber(0 * ether));
		assert.deepEqual(swapContract.getMntpBalance(), new BigNumber(2500 * ether));

		// flags
		assert.deepEqual(oldSwapContract.isActive(), false);
		assert.deepEqual(oldSwapContract.isActual(), false);
		assert.deepEqual(swapContract.isActive(), true);
		assert.deepEqual(swapContract.isActual(), true);
	});

	it("shouldn't interact with outdated contract", async () => {

		// failed to toggle activity
		try {
			await oldSwapContract.toggleActivity({
				from: buyer,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch (e) { }
		try {
			await oldSwapContract.toggleActivity({
				from: creator,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch (e) { }

		// buyer is failed to swap
		{
			// allow 5000
			await mntContract.approve(oldSwapContractAddress, 2500 * ether, {
				from: buyer,
				gas: 2900000
			});

			// swap
			try {
				await oldSwapContract.swapMntp(2500 * ether, sumusAddress, {
					from: buyer,
					gas: 2900000
				});
				assert.fail("Should fail");
			} catch (e) { }
			
			// allow 0
			await mntContract.approve(oldSwapContractAddress, 0 * ether, {
				from: buyer,
				gas: 2900000
			});
		}

		// failed to send 10000 mntp to the buyer
		{
			// old contract got coins somehow
			await mntContract.transfer(oldSwapContractAddress, 10000 * ether, {
				from: service,
				gas: 2900000
			});
			assert.deepEqual(mntContract.balanceOf(service), new BigNumber(0 * ether));
			assert.deepEqual(mntContract.balanceOf(oldSwapContractAddress), new BigNumber(10000 * ether));

			try {
				await oldSwapContract.sendMntp(10000 * ether, buyer, sumusAddress, {
					from: service,
					gas: 2900000
				});
				assert.fail("Should fail");
			} catch (e) { }

			assert.deepEqual(mntContract.balanceOf(oldSwapContractAddress), new BigNumber(10000 * ether));
		}


		// nobody can drain outdated contract
		try {
			await oldSwapContract.drainMntp(buyer, {
				from: service,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch (e) { }
		try {
			await oldSwapContract.drainMntp(buyer, {
				from: buyer,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch (e) { }

		// ... except admin
		await oldSwapContract.drainMntp(service, {
			from: creator,
			gas: 2900000
		});

		assert.deepEqual(mntContract.balanceOf(service), new BigNumber(10000 * ether));
		assert.deepEqual(mntContract.balanceOf(oldSwapContractAddress), new BigNumber(0 * ether));
		assert.deepEqual(mntContract.balanceOf(buyer), new BigNumber(2500 * ether));
	});

	it("should receive buyer's 2500 mntp (new contract)", async () => {

		// allow 2500
		await mntContract.approve(swapContractAddress, 2500 * ether, {
			from: buyer,
			gas: 2900000
		});

		// swap
		await swapContract.swapMntp(2500 * ether, sumusAddress, {
			from: buyer,
			gas: 2900000
		});

		// contract balance
		assert.deepEqual(swapContract.getMntpBalance(), new BigNumber(5000 * ether));
		assert.deepEqual(mntContract.balanceOf(swapContractAddress), new BigNumber(5000 * ether));

		// buyer balance
		assert.deepEqual(mntContract.balanceOf(buyer), new BigNumber(0 * ether));
	});

	it("should drain inactive contract (new contract)", async () => {

		// still active
		try {
			await swapContract.drainMntp(service, {
				from: creator,
				gas: 2900000
			});
			assert.fail("Should fail");
		} catch (e) { }

		// toggle
		await swapContract.toggleActivity({
			from: creator,
			gas: 2900000
		});

		// drain
		await swapContract.drainMntp(service, {
			from: creator,
			gas: 2900000
		});

		// contract balance
		assert.deepEqual(swapContract.getMntpBalance(), new BigNumber(0 * ether));
		assert.deepEqual(mntContract.balanceOf(swapContractAddress), new BigNumber(0 * ether));

		// service balance
		assert.deepEqual(mntContract.balanceOf(service), new BigNumber(15000 * ether));
	});

});
