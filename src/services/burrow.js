const config = require("./config.js");
const burrow = require('@hyperledger/burrow');

// Connect to running burrow chain using the account address to identify our input account and return values as an object
// using named returns where provided
let chain = new burrow.Client(config.get().Burrow.chainIP, config.get().Burrow.accountAddress);
// The contract we will call
let contractAddress = config.get().Burrow.contractAddress;
// A Javascript object that wraps our simplestorage contract and will handle translating Javascript calls to EVM invocations
exports.contract = chain.contractAt(contractAddress).then(res => {
  this.contract = res;
  console.log("Burrow Contract Link OK");
}).catch(err => console.log(err));

exports.formatToArray = function(_contractReturns) {
  let formattedArray = []
  for (var i = 0; i < _contractReturns.length; i++) {
    formattedArray.push(_contractReturns[i].split('|'));
  }
  return formattedArray;
}
