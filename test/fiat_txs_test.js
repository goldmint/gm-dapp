var solc = require('solc');
var Web3 = require('web3');

var fs = require('fs');
var assert = require('assert');
var BigNumber = require('bignumber.js');

// You must set this ENV VAR before testing
//assert.notEqual(typeof(process.env.ETH_NODE),'undefined');
var web3 = new Web3(new Web3.providers.HttpProvider(process.env.ETH_NODE));

var accounts;
var creator;
var buyer;
var buyer2;
var buyer3;
var buyer4;

var goldmintTeamAddress;

var initialBalanceCreator = 0;

var mntContractAddress;
var mntContract;

var goldFeeContractAddress;
var goldFeeContract;

var goldContractAddress;
var goldContract;

var goldFiatFeeContractAddress;
var goldFiatFeeContract;

var fiatContractAddress;
var fiatContract;
var fiatContractOld;


var hotWalletTokenHolderAddress;


eval(fs.readFileSync('./test/helpers/misc.js')+'');

describe('Fiat 1', function() {
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
               buyer3 = accounts[3];
               goldmintTeamAddress = accounts[4];
               buyer4 = accounts[5];
               hotWalletTokenHolderAddress = accounts[6];

               done();
          });
     });

     after("Deinitialize everything", function(done) {
          done();
     });

     it('should deploy token contract',function(done){
          var data = {};

          deployMntContract(data,function(err){
               assert.equal(err,null);
               
               deployGoldFeeContract(data,function(err){
                    assert.equal(err,null);
                    
                    // same as deployGoldContract but deploys 
                    // Gold from Goldmint.sol file
                    deployGoldContract(data,function(err){
                         assert.equal(err,null);

                         deployFiatFeeContract(data,function(err){
                              assert.equal(err,null);

                              deployStorageControllerContract(data,function(err){
                                   assert.equal(err,null);

                                   done();
                              });
                         });
                    });
               });
          });
     });

     it('should set storage controller address',function(done){
          goldContract.setStorageControllerContractAddress(
               fiatContractAddress,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);
                    done();
               }
          );
     });

     it('should set new hot wallet token address',function(done){
		// call old fiatContract 
            fiatContract.setHotWalletAddress(
			// new controller
               hotWalletTokenHolderAddress,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    done();
               }
          );
    });

     it('should not add doc',function(done){
          assert.equal(fiatContract.getDocCount(),0);

          var ipfsLink = "123";
          fiatContract.addDoc(
               ipfsLink,
               {
                    from: buyer,               
                    gas: 2900000 
               },function(err,result){
                    assert.notEqual(err,null);
                    done();
               }
          );
     });

     it('should add doc 1',function(done){
          assert.equal(fiatContract.getDocCount(),0);

          var ipfsLink = "123";
          fiatContract.addDoc(
               ipfsLink,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    assert.equal(fiatContract.getDocCount(),1);

                    var s = fiatContract.getDoc(0);
                    assert.equal(s,ipfsLink);

                    done();
               }
          );
     });
     
     it('should add doc 2',function(done){
		// 64 bytes max (not symbols!)
          var ipfsLink = "1234567890123456789012345678901234567890123456789012345678901234";

          fiatContract.addDoc(
               ipfsLink,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    assert.equal(fiatContract.getDocCount(),2);

                    var s = fiatContract.getDoc(1);
                    assert.equal(s,ipfsLink);

                    done();
               }
          );
     });

     // 2 
     it('should not add fiat tx',function(done){
          var user = "anton";
          var amount = -300;

          fiatContract.addFiatTransaction(
               user,
               amount,
               {
                    from: buyer,               
                    gas: 2900000 
               },function(err,result){
                    assert.notEqual(err,null);
                    done();
               }
          );
     });

     it('should add fiat tx',function(done){
          var user = "anton";

          assert.equal(fiatContract.getFiatTransactionsCount(user),0);
          assert.equal(fiatContract.getAllFiatTransactionsCount(),0);
          assert.equal(fiatContract.getUserFiatBalance(user),0);

          // $3 
          var amount = 300;

          fiatContract.addFiatTransaction(
               user,
               amount,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    assert.equal(fiatContract.getFiatTransactionsCount(user),1);
                    assert.equal(fiatContract.getAllFiatTransactionsCount(),1);
                    assert.equal(fiatContract.getUserFiatBalance(user),300);

                    var amount2 = fiatContract.getFiatTransaction(user,0);
                    assert.equal(amount2,amount);

                    done();
               }
          );
     });

     it('should add fiat tx 2',function(done){
          var user = "kostya";

          assert.equal(fiatContract.getFiatTransactionsCount(user),0);
          assert.equal(fiatContract.getUserFiatBalance(user),0);

          // $5 
          var amount = 500;

          fiatContract.addFiatTransaction(
               user,
               amount,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    assert.equal(fiatContract.getFiatTransactionsCount(user),1);
                    assert.equal(fiatContract.getAllFiatTransactionsCount(),2);
                    assert.equal(fiatContract.getUserFiatBalance(user),500);

                    var amount2 = fiatContract.getFiatTransaction(user,0);
                    assert.equal(amount2,amount);

                    done();
               }
          );
     });

     it('should add fiat tx 3',function(done){
          var user = "kostya";

          var amount = -100;

          fiatContract.addFiatTransaction(
               user,
               amount,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    assert.equal(fiatContract.getFiatTransactionsCount(user),2);
                    assert.equal(fiatContract.getAllFiatTransactionsCount(),3);
                    assert.equal(fiatContract.getUserFiatBalance(user),400);

                    var amount2 = fiatContract.getFiatTransaction(user,1);
                    assert.equal(amount2,amount);

                    done();
               }
          );
     });

     it('should add buy tokens request',function(done){
          var user = "kostya";
          var hash = "1231321";

          assert.equal(fiatContract.getRequestsCount(),0);

          fiatContract.addBuyTokensRequest(
               user,
               hash,
               {
                    from: buyer,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);
                    assert.equal(fiatContract.getRequestsCount(),1);

                    var r = fiatContract.getRequest(0);

				assert.equal(r[0],buyer);
                    assert.equal(r[1],user);
                    assert.equal(r[4],0);    // state

                    done();
               }
          );
     });

     it('should not cancel if not admin',function(done){
          fiatContract.cancelRequest(
               0,
               {
                    from: buyer,               
                    gas: 2900000 
               },function(err,result){
                    assert.notEqual(err,null);
                    assert.equal(fiatContract.getRequestsCount(),1);

                    done();
               }
          );
     });

     it('should cancel request by admin',function(done){
          fiatContract.cancelRequest(
               0,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);
                    assert.equal(fiatContract.getRequestsCount(),1);

                    var r = fiatContract.getRequest(0);
                    assert.equal(r[4],2);

                    done();
               }
          );
     });

     it('should not process cancelled request',function(done){
          var amountCents = 100;

          // 1 GOLD - $500
          var centsPerGold = (500 * 100);
          
          fiatContract.processRequest(
               0,
               amountCents,
               centsPerGold,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.notEqual(err,null);
                    done();
               }
          );
     });

     it('should add buy tokens request 2',function(done){
          var user = "anton";
		// 64 bytes max (not symbols!)
          var hash = "1234567890123456789012345678901234567890123456789012345678901234";

          assert.equal(fiatContract.getRequestsCount(),1);

          fiatContract.addBuyTokensRequest(
               user,
               hash,
               {
                    from: buyer2,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);
                    assert.equal(fiatContract.getRequestsCount(),2);

                    var r = fiatContract.getRequest(1);
                    assert.equal(r[0],buyer2);
                    assert.equal(r[1],user);
                    assert.equal(r[2],hash);
                    assert.equal(r[4],0);    // state

                    done();
               }
          );
     });


     it('should add fiat tx 4',function(done){
        var user = "anton";

        // $3 
        var amount = -300;

        fiatContract.addFiatTransaction(
             user,
             amount,
             {
                  from: creator,               
                  gas: 2900000 
             },function(err,result){
                  assert.equal(err,null);

                  assert.equal(fiatContract.getUserFiatBalance(user),0);

                  done();
             }
        );
     });

     it('should not process request if no fiat',function(done){
          var amountCents = 500;
          // 1 GOLD - $500
          var centsPerGold = (500 * 100);

          fiatContract.processRequest(
               1,
               amountCents,
               centsPerGold,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    
                    assert.notEqual(err,null);
                    done();
               }
          );
     });

     it('should add fiat tx 5',function(done){
          var user = "xxx"; 
          var amount = 120000;        // $1200 

          fiatContract.addFiatTransaction(
               user,
               amount,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);
                    done();
               }
          );
     });

     it('should add buy tokens request',function(done){
          var user = "xxx";
          var hash = "1231231231231";

          fiatContract.addBuyTokensRequest(
               user,
               hash,
               {
                    from: buyer3,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);
                    assert.equal(fiatContract.getRequestsCount(),3);

                    var r = fiatContract.getRequest(2);
                    assert.equal(r[0],buyer3);
                    assert.equal(r[1],user);
                    assert.equal(r[4],0);    // state

                    done();
               }
          );
     });

     it('should process request',function(done){
          var amountCents = 100000;

          // 1 GOLD - $500
          var centsPerGold = (500 * 100);
          
          var balance = goldContract.balanceOf(buyer3);
          assert.equal(balance, 0);

          // buyer -> buyer3
          fiatContract.processRequest(
               2,
               amountCents,
               centsPerGold,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    // 120000 - 100000
                    var user = 'xxx';
                    assert.equal(fiatContract.getUserFiatBalance(user),20000);

                    var goldmintFeeAccount = "12312312";
                    //assert.equal(fiatContract.getUserFiatBalance(goldmintFeeAccount),3);

                    // GOLD balance should be increased
                    var balance = goldContract.balanceOf(buyer3);
                    assert.equal(balance, 2000000000000000000)

                    var r = fiatContract.getRequest(2);
                    assert.equal(r[0],buyer3);
                    assert.equal(r[1],"xxx");
                    assert.equal(r[4],1);    // state

                    var hotWalletBalance = goldContract.balanceOf(fiatContract.getHotWalletAddress());

                    assert.equal(hotWalletBalance,0);  

                    done();
               }
          );
     });

     it('should add buy tokens request 2',function(done){
          var user = "xxx";
          var hash = "1231231231232";

          fiatContract.addBuyTokensRequest(
               user,
               hash,
               {
                    from: buyer3,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);
                    done();
               }
          );
     });

     it('should process request 2',function(done){
          // 20000 left only
          var amountCents = 100000;

          // 1 GOLD - $500
          var centsPerGold = (400 * 100);

          fiatContract.processRequest(
               3,
               amountCents,
               centsPerGold,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    var user = 'xxx';
                    assert.equal(fiatContract.getUserFiatBalance(user),0);

                    // GOLD balance should be increased
                    var balance = goldContract.balanceOf(buyer3);
                    // total bought was 2 + 0.5 = 2.5
                    assert.equal(balance, 2500000000000000000 );

                    done();
               }
          );
     });

     it('should add sell tokens request 3',function(done){
          var user = "xxx";
          var hash = "1231231231232";

          fiatContract.addSellTokensRequest(
               user,
               hash,
               {
                    from: buyer3,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);
                    done();
               }
          );
     });

     it('should process request 3',function(done){

        var balanceBefore = goldContract.balanceOf(buyer3);
        
          // sell $100 worth of tokens 
          var amountCents = 10000;
            
          // 1 GOLD - $500
          var centsPerGold = (500 * 100);

          fiatContract.processRequest(
               4,
               amountCents,
               centsPerGold,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);
                    
                    // should be increased: 100$ - 3% = 97$
                    var user = 'xxx';
                    assert.equal(fiatContract.getUserFiatBalance(user),9700);

                    // GOLD balance should be decreased  
                    var balance = goldContract.balanceOf(buyer3);

                    var sell = (amountCents * 1000000000000000000 / centsPerGold);
                    var shouldBe = balanceBefore - sell;

                    assert.equal(balance, shouldBe);

                    done();
               }
          );
     });



     it('should add fiat tx 6', function(done) {
        var user = "hot-wallet";

        // $3 
        var amount = 300000;

        fiatContract.addFiatTransaction(
             user,
             amount,
             {
                  from: creator,               
                  gas: 2900000 
             },function(err,result){
                  assert.equal(err,null);

                  assert.equal(fiatContract.getUserFiatBalance(user),300000);

                  done();
             }
        );
     });   

    it('should process inner buy request',function(done) {

        var user = "hot-wallet";

        var balanceBefore = goldContract.balanceOf(fiatContract.getHotWalletAddress());

        // 20000 left only
        var amountCents = 100000;

        // 1 GOLD - $500
        var centsPerGold = (500 * 100);

        fiatContract.processInternalRequest(
             user,
             true,
             amountCents,
             centsPerGold,
             {
                  from: creator,               
                  gas: 2900000 
             },function(err,result){
                  assert.equal(err,null);

                  assert.equal(fiatContract.getUserFiatBalance(user), 200000);

                  // GOLD balance should be increased
                  var balance = goldContract.balanceOf(fiatContract.getHotWalletAddress());
                  // total bought was 2
                  assert.equal(balance, 2000000000000000000);

                  done();
             }
        );
    });

    it('should add fiat tx 7', function(done) {
        var user = "hot-wallet-1";

        // $3 
        var amount = 3000 * 100;

        fiatContract.addFiatTransaction(
            user,
            amount,
            {
                from: creator,               
                gas: 2900000 
            },function(err,result){
                assert.equal(err,null);

                assert.equal(fiatContract.getUserFiatBalance(user),300000);

                done();
            }
        );
    });      

    it('should process inner buy request',function(done) {

        var user = "hot-wallet-1";

        var balanceBefore = goldContract.balanceOf(fiatContract.getHotWalletAddress());

        // 20000 left only
        var amountCents = 1000 * 100;

        // 1 GOLD - $500
        var centsPerGold = (500 * 100);

        fiatContract.processInternalRequest(
             user,
             true,
             amountCents,
             centsPerGold,
             {
                  from: creator,               
                  gas: 2900000 
             },function(err,result){
                  assert.equal(err,null);

                  assert.equal(fiatContract.getUserFiatBalance(user), 2000 * 100);

                  // GOLD balance should be increased
                  var balance = goldContract.balanceOf(fiatContract.getHotWalletAddress());
                  // total bought was 2
                  assert.equal(balance, 4000000000000000000);

                  done();
             }
        );
    });

 
    it('should process inner sell request 1',function(done) {

        var user = "hot-wallet-1";

        var balanceUserGoldBefore = fiatContract.getUserHotGoldBalance(user);

        var balanceFiatBefore = fiatContract.getUserFiatBalance(user);

        var hotWalletGoldBalance = goldContract.balanceOf(fiatContract.getHotWalletAddress());


        // 2000$ left only
        var amountCents = 5000 * 100;

        // 1 GOLD - $500
        var centsPerGold = (500 * 100);

        fiatContract.processInternalRequest(
            user,
            false,
            amountCents,
            centsPerGold,
            {
                from: creator,               
                gas: 2900000 
            },function(err,result){
                assert.equal(err,null);

                //
                assert.equal(fiatContract.getUserFiatBalance(user), 297000);
                assert.equal(fiatContract.getUserHotGoldBalance(user), 0);
                assert.equal(goldContract.balanceOf(fiatContract.getHotWalletAddress()), hotWalletGoldBalance - balanceUserGoldBefore);

                // GOLD balance should be increased
                var balance = goldContract.balanceOf(fiatContract.getHotWalletAddress());
                // total bought was 2
                assert.equal(balance, 2000000000000000000);

                done();
            }
        );
    });


    it('should not process transfer from hot wallet',function(done) {
        var user = "hot-wallet";

        var balanceBefore = fiatContract.getUserHotGoldBalance(user);


        fiatContract.transferGoldFromHotWallet(
            buyer4,
            balanceBefore,
            user,
            {
                 from: buyer,               
                 gas: 2900000 
            },function(err,result){
                 assert.notEqual(err,null);

                 done();
            }
       );
    });

    it('should process transfer from hot wallet',function(done) {
        var user = "hot-wallet";

        var userBalanceBefore = fiatContract.getUserHotGoldBalance(user);
        var hotWalletBalanceBefore = goldContract.balanceOf(fiatContract.getHotWalletAddress());


        fiatContract.transferGoldFromHotWallet(
            buyer4,
            2000000000000000000,
            user,
            {
                 from: creator,               
                 gas: 2900000 
            },function(err,result){
                 assert.equal(err,null);

                 assert.equal(fiatContract.getUserHotGoldBalance(user), 0);

                 var buyerBalance = goldContract.balanceOf(buyer4);

                 assert.equal(buyerBalance, 2000000000000000000);

                 var hotWalletBalanceAfter = goldContract.balanceOf(fiatContract.getHotWalletAddress());

                 assert.equal(hotWalletBalanceAfter, hotWalletBalanceBefore - 2000000000000000000);



                 done();
            }
       );
    });    
});

var ethDepoistAddress;

describe('Fiat 2 - change the controller', function() {
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
               buyer3 = accounts[3];
               goldmintTeamAddress = accounts[4];
               ethDepoistAddress = accounts[5];

               done();
          });
     });

     after("Deinitialize everything", function(done) {
          done();
     });

     it('should deploy token contract',function(done){
        var data = {};

        deployMntContract(data,function(err){
             assert.equal(err,null);
             
             deployGoldFeeContract(data,function(err){
                  assert.equal(err,null);

                  // same as deployGoldContract but deploys 
                  // Gold from Goldmint.sol file
                  deployGoldContract(data,function(err){
                       assert.equal(err,null);

                       deployFiatFeeContract(data,function(err){
                            assert.equal(err,null);

                            deployStorageControllerContract(data,function(err){
                                 assert.equal(err,null);

                                 done();
                            });
                       });
                  });
             });
        });
   });


     it('should add doc 1',function(done){
          assert.equal(fiatContract.getDocCount(),0);

          var ipfsLink = "123";
          fiatContract.addDoc(
               ipfsLink,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    assert.equal(fiatContract.getDocCount(),1);

                    var s = fiatContract.getDoc(0);
                    assert.equal(s,ipfsLink);

                    done();
               }
          );
     });
     
     it('should change the controller',function(done){
		var storageAddressWas = fiatContract.stor();
		console.log('EXISTING STORAGE ADDRESS: ');
		console.log(storageAddressWas);

		var file = './contracts/Storage.sol';
		var contractName = ':StorageController';

		fs.readFile(file, function(err, result){
			assert.equal(err,null);

			var source = result.toString();
			assert.notEqual(source.length,0);

			assert.equal(err,null);

			var output = solc.compile(source, 0); // 1 activates the optimiser

			var abi = JSON.parse(output.contracts[contractName].interface);
			var bytecode = output.contracts[contractName].bytecode;
			var tempContract = web3.eth.contract(abi);

			var alreadyCalled = false;

			tempContract.new(
                mntContractAddress,
				goldContractAddress,
				storageAddressWas,		// use old storage with new controller!
                goldFiatFeeContractAddress,
				{
					from: creator, 
					// should not exceed 5000000 for Kovan by default
					gas: 5995000,
					//gasPrice: 120000000000,
					data: '0x' + bytecode
				}, 
				function(err, c){
					assert.equal(err, null);

					console.log('TX HASH: ');
					console.log(c.transactionHash);

					// TX can be processed in 1 minute or in 30 minutes...
					// So we can not be sure on this -> result can be null.
					web3.eth.getTransactionReceipt(c.transactionHash, function(err, result){
						//console.log('RESULT: ');
						//console.log(result);

						assert.equal(err, null);
						assert.notEqual(result, null);

						if(!alreadyCalled){
							alreadyCalled = true;

							assert.notEqual(fiatContractAddress, result.contractAddress);
							// save old 
							fiatContractOld = web3.eth.contract(abi).at(fiatContractAddress);

							fiatContractAddress = result.contractAddress;
							fiatContract = web3.eth.contract(abi).at(fiatContractAddress);

							done();
						}
					});
				});
		});
     });

     it('should get doc 1 from old storage',function(done){
          assert.equal(fiatContract.getDocCount(),1);

          var ipfsLink = "123";
		var s = fiatContract.getDoc(0);
		assert.equal(s,ipfsLink);

		done();
     });

	it('should set new controller address to storage',function(done){
		// call old fiatContract 
          fiatContractOld.changeController(
			// new controller
               fiatContractAddress,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);
                    assert.equal(fiatContract.getDocCount(),1);

                    done();
               }
          );

    });
    

     it('should add doc 2 to new controller',function(done){
          var ipfsLink = "999";
          fiatContract.addDoc(
               ipfsLink,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    assert.equal(fiatContract.getDocCount(),2);
                    var s = fiatContract.getDoc(1);
                    assert.equal(s,ipfsLink);

                    done();
               }
          );
     });


     it('should set eth deposit address',function(done){

        fiatContract.setEthDepositAddress(
            ethDepoistAddress,
             {
                  from: creator,               
                  gas: 2900000 
             },function(err,result){
                  assert.equal(err,null);

                  assert.equal(fiatContract.getEthDepositAddress(), ethDepoistAddress);

                  done();
             }
        );
   });

   it('should not deposit eth',function(done){
    var balance1Before = parseInt(web3.eth.getBalance(buyer));
    var depositAddressBalanceBefore = parseInt(web3.eth.getBalance(ethDepoistAddress));

    console.log("balance1Before: " + balance1Before);
    console.log("depositAddressBalanceBefore: " + depositAddressBalanceBefore);

        fiatContract.depositEth(
            0,
            {
                from: buyer,               
                gas: 2900000,
                value: 10000000000 
            },function(err,result){
                assert.notEqual(err,null);

                done();
            }
        );
    });

   it('should deposit eth',function(done){
    var balance1Before = parseInt(web3.eth.getBalance(buyer));
    var depositAddressBalanceBefore = parseInt(web3.eth.getBalance(ethDepoistAddress));

    console.log("balance1Before: " + balance1Before);
    console.log("depositAddressBalanceBefore: " + depositAddressBalanceBefore);

        fiatContract.depositEth(
            0,
            {
                from: buyer,               
                gas: 2900000,
                value: 10000000000000000  
            },function(err,result){
                assert.equal(err,null);

                var balance1After = web3.eth.getBalance(buyer);
                var depositAddressBalanceAfter = web3.eth.getBalance(ethDepoistAddress);

                console.log("balance1After: " + balance1After);
                console.log("depositAddressBalanceAfter: " + depositAddressBalanceAfter);

                //assert.equal(balance1After, balance1Before - 1000000000000000000);
                assert.equal(depositAddressBalanceAfter, depositAddressBalanceBefore + 10000000000000000);

                done();
            }
        );
    });

});
