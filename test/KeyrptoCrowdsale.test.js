"use strict";

// Imports
const blockchainTime = require('./helpers/time');
const duration = blockchainTime.duration;
const assertExtra = require('./helpers/assert');
assert.evmThrows = assertExtra.evmThrows;
assert.eventValuesEqual = assertExtra.eventValuesEqual;
const BigNumber = web3.BigNumber;
const { ether, wei } = require('./helpers/ether');

// Contracts
const KeyrptoCrowdsale = artifacts.require('KeyrptoCrowdsale');
const KeyrptoToken = artifacts.require('KeyrptoToken');

// Constants
const ONE_TOKEN = new BigNumber('1e+18');

contract('KeyrptoCrowdsale', function ([owner, teamWallet, investor, investor2, investor3, investor4]) {
  let crowdsale;
  let token;

  const crowdsaleArgs = { };
  const RATE = new BigNumber(120000);
  const CAP = ether(10);

  beforeEach(async function() {
    crowdsaleArgs.startTime = blockchainTime.latestTime() + duration.weeks(1);
    crowdsaleArgs.mainStartTime = crowdsaleArgs.startTime + duration.weeks(1);
    crowdsaleArgs.endTime = crowdsaleArgs.mainStartTime + duration.weeks(4);
    crowdsale = await KeyrptoCrowdsale.new(crowdsaleArgs.startTime,
                                           crowdsaleArgs.mainStartTime,
                                           crowdsaleArgs.endTime,
                                           RATE,
                                           CAP,
                                           teamWallet, {from: owner});
    token = KeyrptoToken.at(await crowdsale.token());
  });

  describe('After construction', async function() {
    it('correct parameters were used', async function() {
      assert.equal(await crowdsale.startTime(), crowdsaleArgs.startTime);
      assert.equal(await crowdsale.mainStartTime(), crowdsaleArgs.mainStartTime);
      assert.equal(await crowdsale.endTime(), crowdsaleArgs.endTime);
      assert.deepEqual(await crowdsale.rate(), RATE);
      assert.deepEqual(await crowdsale.cap(), CAP);
      assert.equal(await crowdsale.wallet(), teamWallet);
      assert.equal(await crowdsale.owner(), owner);
    });

    it('crowsdsale should have correct initial state', async function() {
      assert.equal(await crowdsale.weiRaised(), 0);
      assert.equal(await crowdsale.isFinalized(), false);
    });

    it('token should have correct initial state', async function() {
      assert.equal(await token.owner(), crowdsale.address);
      assert.equal(await token.teamWallet(), teamWallet);
      assert.equal(await token.paused(), true);
      assert.equal(await token.mintingFinished(), false);
      assert.deepEqual(await token.totalSupply(), new BigNumber(0));
      assert.equal(await token.teamTokensMinted(), false);
    });
  });

  describe('Presale has not yet started', async function() {
    beforeEach(async function() {
      await blockchainTime.increaseTimeTo(crowdsaleArgs.startTime - duration.days(1));
    });

    it('only owner should be able to update rate', async function() {
      await crowdsale.updateRate(2222, {from: owner});

      await assert.evmThrows(crowdsale.updateRate(3333, {from: investor}));
      assert.deepEqual(await crowdsale.rate(), new BigNumber(2222));
    });

    it('only owner should be able to manage whitelist', async function() {
      await crowdsale.whitelist(investor, {from: owner});
      await crowdsale.whitelist(investor2, {from: owner});
      await crowdsale.blacklist(investor2, {from: owner});
      assert.equal(await crowdsale.whitelisted(investor), true);
      assert.equal(await crowdsale.whitelisted(investor2), false);

      await assert.evmThrows(crowdsale.whitelist(investor3, {from: investor}));
      await assert.evmThrows(crowdsale.blacklist(investor3, {from: investor}));
    });
  });

  describe('Presale has started', async function() {
    beforeEach(async function() {
      await blockchainTime.increaseTimeTo(crowdsaleArgs.startTime);
      await crowdsale.whitelist(investor, {from: owner});
      await crowdsale.whitelist(investor2, {from: owner});
      await crowdsale.whitelist(investor3, {from: owner});
    });

    it('tokens should be sold with 20% discount', async function() {
      const teamWalletBalanceBefore = web3.eth.getBalance(teamWallet);
      const amount = ether(0.1);

      const txResult = await crowdsale.buyTokens(investor, {value: amount, from: investor});

      const expectedTokensSold = amount.mul(RATE).mul(1.25);
      assert.eventValuesEqual(txResult.logs[0], 'TokenPurchase', {
         purchaser: investor,
         beneficiary: investor,
         value: amount,
         amount: expectedTokensSold
      });
      assert.deepEqual(await token.balanceOf(investor), expectedTokensSold);
      assert.deepEqual(await token.totalSupply(), expectedTokensSold);
      assert.deepEqual(await crowdsale.weiRaised(), amount);
      assert.deepEqual(web3.eth.getBalance(teamWallet), teamWalletBalanceBefore.plus(amount));
    });

    it('tokens should be sold with minimum transaction value of 0.1 ETH', async function() {
      const amount = ether(0.099999);

      await assert.evmThrows(crowdsale.buyTokens(investor, {value: amount, from: investor}));
    });

    it('tokens should be sold with maximum investment of 2 ETH per address', async function() {
      const initialAmount = ether(1.90001);
      await crowdsale.buyTokens(investor, {value: initialAmount, from: investor});
      const amount = ether(0.1);

      await assert.evmThrows(crowdsale.buyTokens(investor, {value: amount, from: investor}));
    });

    it('tokens should be sold with hard cap of 31.875M tokens during presale', async function() {
      await crowdsale.updateRate(10000000, {from: owner});      // 1 ETH = 10M KYT = 100 000 USD
      await crowdsale.buyTokens(investor, {value: ether(2), from: investor});

      await assert.evmThrows(crowdsale.buyTokens(investor2, {value: ether(0.56), from: investor2}));
      await crowdsale.buyTokens(investor2, {value: ether(0.55), from: investor2})

      assert.deepEqual(await token.totalSupply(), new BigNumber(31875000).times(ONE_TOKEN));
      assert.deepEqual(await crowdsale.weiRaised(), ether(2.55));
      await assert.evmThrows(crowdsale.buyTokens(investor3, {value: ether(0.1), from: investor3}));

      // sales should continue once main sale starts
      await blockchainTime.increaseTimeTo(crowdsaleArgs.mainStartTime);

      await crowdsale.buyTokens(investor3, {value: ether(0.1), from: investor3});

      assert.deepEqual(await crowdsale.weiRaised(), ether(2.65));
    });

    it('tokens should not be bought via fallback function', async function() {
      await assert.evmThrows(crowdsale.sendTransaction({value: ether(1), from: investor}));
    });

    it('only owner should be able to update rate', async function() {
      await crowdsale.updateRate(2222, {from: owner});

      await assert.evmThrows(crowdsale.updateRate(3333, {from: investor}));
      assert.deepEqual(await crowdsale.rate(), new BigNumber(2222));
    });

    it('only owner should be able to manage whitelist', async function() {
      await crowdsale.blacklist(investor, {from: owner});
      await crowdsale.blacklist(investor2, {from: owner});
      await crowdsale.whitelist(investor2, {from: owner});
      assert.equal(await crowdsale.whitelisted(investor), false);
      assert.equal(await crowdsale.whitelisted(investor2), true);
      assert.equal(await crowdsale.whitelisted(investor3), true);

      await assert.evmThrows(crowdsale.whitelist(investor3, {from: investor}));
      await assert.evmThrows(crowdsale.blacklist(investor3, {from: investor}));
    });

    it('tokens should not be sold to non-whitelisted addresses', async function() {
      const amount = ether(0.1);

      await assert.evmThrows(crowdsale.buyTokens(investor4, {value: amount, from: investor4}));
    });
  });

  describe('Main sale has started', async function() {
    beforeEach(async function() {
      await crowdsale.whitelist(investor, {from: owner});
      await crowdsale.whitelist(investor2, {from: owner});
      await crowdsale.whitelist(investor3, {from: owner});
      await blockchainTime.increaseTimeTo(crowdsaleArgs.startTime);
      await crowdsale.buyTokens(investor3, {value: ether(2), from: investor3});
      await crowdsale.buyTokens(investor2, {value: ether(0.1), from: investor2});
      await blockchainTime.increaseTimeTo(crowdsaleArgs.mainStartTime);
    });

    it('tokens should be sold at full price', async function() {
      const teamWalletBalanceBefore = web3.eth.getBalance(teamWallet);
      const totalSupplyBefore = await token.totalSupply();
      const weiRaisedBefore = await crowdsale.weiRaised();
      const amount = ether(0.1);

      const txResult = await crowdsale.buyTokens(investor, {value: amount, from: investor});

      const expectedTokensSold = amount.mul(RATE);
      assert.eventValuesEqual(txResult.logs[0], 'TokenPurchase', {
         purchaser: investor,
         beneficiary: investor,
         value: amount,
         amount: expectedTokensSold
      });
      assert.deepEqual(await token.balanceOf(investor), expectedTokensSold);
      assert.deepEqual(await token.totalSupply(), totalSupplyBefore.plus(expectedTokensSold));
      assert.deepEqual(await crowdsale.weiRaised(), weiRaisedBefore.plus(amount));
      assert.deepEqual(web3.eth.getBalance(teamWallet), teamWalletBalanceBefore.plus(amount));
    });

    it('tokens sold during presale should be recorded before first sale', async function() {
      const totalSupplyBefore = await token.totalSupply();
      const amount = ether(0.2);

      await crowdsale.buyTokens(investor, {value: amount, from: investor});
      await crowdsale.buyTokens(investor2, {value: amount, from: investor2});
      await crowdsale.buyTokens(investor3, {value: amount, from: investor3});

      assert.deepEqual(await crowdsale.tokensSoldDuringPresale(), totalSupplyBefore);
    });

    it('tokens should be sold with minimum transaction value of 0.1 ETH', async function() {
      const amount = ether(0.099999);

      await assert.evmThrows(crowdsale.buyTokens(investor, {value: amount, from: investor}));
    });

    it('tokens should be sold with no maximum investment', async function() {
      const txResult = await crowdsale.buyTokens(investor, {value: ether(5), from: investor3});

      assert.eventValuesEqual(txResult.logs[0], 'TokenPurchase', {
         purchaser: investor3,
         beneficiary: investor,
         value: ether(5),
         amount: ether(5).mul(RATE)
      });
    });

    it('tokens should be sold until hard cap is reached', async function() {
      const newRate = 100000000;                            // 1 ETH = 100M KYT = 1 000 000 USD
      await crowdsale.updateRate(newRate, {from: owner});
      const remainingToCap = CAP.minus(await crowdsale.weiRaised());

      const txResult = await crowdsale.buyTokens(investor, {value: remainingToCap, from: investor});
      assert.eventValuesEqual(txResult.logs[0], 'TokenPurchase', {
         purchaser: investor,
         beneficiary: investor,
         value: remainingToCap,
         amount: remainingToCap.mul(newRate)
      });
      assert.deepEqual(await crowdsale.weiRaised(), CAP);
      assert.equal(await crowdsale.hasEnded(), true);
    });

    it('transaction exceeding hard-cap should be rejected', async function() {
      const remainingToCap = CAP.minus(await crowdsale.weiRaised());
      const amount = remainingToCap.plus(wei(1));

      await assert.evmThrows(crowdsale.buyTokens(investor, {value: amount, from: investor}));
    });

    it('crowdsale should end once main sale time runs out', async function() {
      await blockchainTime.increaseTimeTo(crowdsaleArgs.endTime + duration.seconds(1));

      assert.equal(await crowdsale.hasEnded(), true);
    });

    it('only owner should be able to manage whitelist', async function() {
      await crowdsale.blacklist(investor, {from: owner});
      await crowdsale.blacklist(investor2, {from: owner});
      await crowdsale.whitelist(investor2, {from: owner});
      assert.equal(await crowdsale.whitelisted(investor), false);
      assert.equal(await crowdsale.whitelisted(investor2), true);
      assert.equal(await crowdsale.whitelisted(investor3), true);

      await assert.evmThrows(crowdsale.whitelist(investor3, {from: investor}));
      await assert.evmThrows(crowdsale.blacklist(investor3, {from: investor}));
    });

    it('tokens should not be sold to non-whitelisted addresses', async function() {
      const amount = ether(0.1);

      await assert.evmThrows(crowdsale.buyTokens(investor4, {value: amount, from: investor4}));
    });
  });

  describe('Crowdsale has ended', async function() {
    beforeEach(async function() {
      await crowdsale.whitelist(investor, {from: owner});
      await crowdsale.whitelist(investor2, {from: owner});
      await crowdsale.whitelist(investor3, {from: owner});
      await blockchainTime.increaseTimeTo(crowdsaleArgs.startTime);
      await crowdsale.buyTokens(investor3, {value: ether(2), from: investor3});
      await crowdsale.buyTokens(investor2, {value: ether(0.1), from: investor2});
      await blockchainTime.increaseTimeTo(crowdsaleArgs.mainStartTime);
      await crowdsale.buyTokens(investor, {value: ether(0.1), from: investor});
      await crowdsale.buyTokens(investor, {value: ether(0.7), from: investor});
      await blockchainTime.increaseTimeTo(crowdsaleArgs.endTime + duration.seconds(1));
    });

    it('crowsdsale should have correct state', async function() {
      assert.equal(await crowdsale.hasEnded(), true);
      assert.equal(await crowdsale.isFinalized(), false);
    });

    it('finalization should mint team tokens and transfer ownership', async function() {
      const fifthOfPresaleTokens = ether(2.1).mul(RATE).div(4);
      const totalSupplyBeforeFinalization = await token.totalSupply();

      const txResult = await crowdsale.finalize({from: owner});

      const expectedMintedTokens = new BigNumber('490e+6').times(ONE_TOKEN).sub(fifthOfPresaleTokens);
      assert.deepEqual(await token.totalSupply(), totalSupplyBeforeFinalization.plus(expectedMintedTokens));
      assert.deepEqual(await token.balanceOf(teamWallet), expectedMintedTokens);
      assert.equal(await token.mintingFinished(), true);
      assert.equal(await crowdsale.isFinalized(), true);
      assert.equal(await token.owner(), teamWallet);
    });
  });
});