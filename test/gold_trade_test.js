const Web3 = require('web3');
const assert = require('assert');
const BigNumber = require('bignumber.js');
const deploy = require('./helpers/deploy');

var web3 = new Web3(new Web3.providers.HttpProvider(process.env.ETH_NODE));

var creator;
var buyer;

var accessContractAddr;
var accessContract;

var controllerContractAddr;
var controllerContract;

var ether = 1000000000000000000;

describe('GOLD TRADE MAIN', function () {

	before("Initialize everything", (done) => {
		web3.eth.getAccounts(function (err, as) {
			assert.equal(err, null);

			creator = as[0];
			buyer = as[1];

			done();
		});
	});

	after("Deinitialize everything", (done) => {
		done();
	});

	it("depoy contracts", async () => {
		var res = await deploy.contract(
			web3, "./contracts/GoldTrade.sol", ":Access",
			creator, 3000000
		);
		accessContractAddr = res.address;
		accessContract = res.contract;

		var res = await deploy.contract(
			web3, "./contracts/GoldTrade.sol", ":Controller",
			creator, 3000000, [accessContractAddr]
		);
		controllerContractAddr = res.address;
		controllerContract = res.contract;
	});

	it("controller is active", async () => {
		assert.equal(controllerContract.isActual(), true);
		assert.equal(controllerContract.isActive(), true);
	});

	it("check Access contract", async () => {
		assert.equal(accessContract.isAdmin(creator), true);
		assert.equal(accessContract.isAdmin(buyer), false);
	});
	
	it("check setActive() method", async () => {
		// should fail
		try {
			await controllerContract.setActive(false, {
				from: buyer,
				gas: 2900000
			});
			assert.fail("should fail");
		} catch (e) { }

		await controllerContract.setActive(true, {
			from: creator,
			gas: 2900000
		});
	});

	it("direct eth transfer should fail", async () => {
		// should fail
		try {
			web3.sendTransaction({to: accessContractAddr, from: buyer, value: 1 * ether});
			assert.fail("should fail");
		} catch (e) { }

		// should fail
		try {
			web3.sendTransaction({to: controllerContract, from: buyer, value: 1 * ether});
			assert.fail("should fail");
		} catch (e) { }
	});

	it("buyer buys gold", async () => {
		assert.deepEqual(web3.eth.getBalance(controllerContractAddr), new BigNumber(0));

		await controllerContract.buyGold(
			1, new Uint8Array(32),
			{
				from: buyer,
				gas: 999999,
				value: 1*ether,
			}
		);

		assert.deepEqual(web3.eth.getBalance(controllerContractAddr), new BigNumber(1 * ether));
	});

	it("controller deactivation", async () => {
		// should fail
		try {
			await controllerContract.deactivate(buyer, {
				from: buyer,
				gas: 2900000
			});
			assert.fail("should fail");
		} catch (e) { }

		await controllerContract.deactivate(creator, {
			from: creator,
			gas: 2900000
		});

		assert.deepEqual(web3.eth.getBalance(controllerContractAddr), new BigNumber(0));
	});
});
