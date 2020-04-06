const solc = require('solc');
const fs = require('fs');
const assert = require('assert');

module.exports = {
	contract: async (web3, file, name, from, gas, args) => {
		var source = fs.readFileSync(file).toString();
		assert.notEqual(source.length, 0);

		var output = solc.compile(source, 1); // 1 activates the optimiser
		var abi = JSON.parse(output.contracts[name].interface);
		var bytecode = output.contracts[name].bytecode;
		var contract = web3.eth.contract(abi);

		var from = {
			from: from, 
			gas: gas,
			data: '0x' + bytecode
		};

		try {
			var res = contract.new(args, from);
			assert.notEqual(res, null);
			
			res = web3.eth.getTransactionReceipt(res.transactionHash);
			assert.notEqual(res, null);

			return {
				address: res.contractAddress,
				contract: web3.eth.contract(abi).at(res.contractAddress),
			}
		} catch (e) {
			console.log(e);
		}
		return null;
	},
}