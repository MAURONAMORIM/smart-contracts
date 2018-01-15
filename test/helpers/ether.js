"use strict";

module.exports.ether = function ether(n) {
	return new web3.BigNumber(web3.toWei(n, 'ether'));
}

module.exports.wei = function wei(n) {
	return new web3.BigNumber(n);
}