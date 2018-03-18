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
const KeyrptoCrowdsale2 = artifacts.require('KeyrptoCrowdsale2');
const KeyrptoToken = artifacts.require('KeyrptoToken');

// Constants
const ONE_TOKEN = new BigNumber('1e+18');
const MILLION_TOKENS = new BigNumber('1e+24');

contract('KeyrptoCrowdsale2', function ([owner, teamWallet, investor, investor2, investor3, investor4]) {
  const crowdsaleArgs = { };
  const RATE = new BigNumber(70000);
  const TOTAL_TEAM_TOKENS = MILLION_TOKENS.times(900);
  const TOKENS_FOR_SALE = MILLION_TOKENS.times(475);
  let crowdsale;
  let token;

  beforeEach(async function() {
    token = await KeyrptoToken.new({from: owner});
    await token.setTeamWallet(teamWallet, {from: owner});
    await token.mint(teamWallet, TOTAL_TEAM_TOKENS, {from: owner});

    crowdsaleArgs.openingTime = blockchainTime.latestTime() + duration.weeks(1);
    crowdsaleArgs.closingTime = crowdsaleArgs.openingTime + duration.weeks(5);
    crowdsale = await KeyrptoCrowdsale2.new(crowdsaleArgs.openingTime,
                                            crowdsaleArgs.closingTime,
                                            RATE,
                                            teamWallet,
                                            token.address, {from: owner});
    await token.unpause({from: owner});
    await token.approve(crowdsale.address, TOKENS_FOR_SALE, {from: teamWallet});
  });

  describe('After construction', async function() {
    it('correct parameters were used and correct initial state', async function() {
      assert.equal(await crowdsale.openingTime(), crowdsaleArgs.openingTime);
      assert.equal(await crowdsale.closingTime(), crowdsaleArgs.closingTime);
      assert.deepEqual(await crowdsale.rate(), RATE);
      assert.equal(await crowdsale.wallet(), teamWallet);
      assert.equal(await crowdsale.token(), token.address);
      assert.equal(await crowdsale.weiRaised(), 0);
    });
  });

  describe('Crowdsale not yet open', async function() {
    beforeEach(async function() {
      await blockchainTime.increaseTimeTo(crowdsaleArgs.openingTime - duration.days(1));
    });

    it('tokens cannot be bought', async function() {
      await assert.evmThrows(crowdsale.buyTokens(investor, {value: ether(0.1), from: investor}));
    });
  });

  describe('Crowdsale is in first week', async function() {
    beforeEach(async function() {
      await blockchainTime.increaseTimeTo(crowdsaleArgs.openingTime);
    });

    it('tokens should be sold with 25% bonus', async function() {
      const teamWalletBalanceBefore = web3.eth.getBalance(teamWallet);
      const teamTokenBalanceBefore = await token.balanceOf(teamWallet);
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
      assert.deepEqual(await token.balanceOf(teamWallet), teamTokenBalanceBefore.minus(expectedTokensSold));
      assert.deepEqual(await crowdsale.weiRaised(), amount);
      assert.deepEqual(web3.eth.getBalance(teamWallet), teamWalletBalanceBefore.plus(amount));
    });

    it('tokens should be sold via fallback function', async function() {
      const teamWalletBalanceBefore = web3.eth.getBalance(teamWallet);
      const teamTokenBalanceBefore = await token.balanceOf(teamWallet);
      const investorTokenBalanceBefore = await token.balanceOf(investor);
      const amount = ether(0.1);

      const txResult = await crowdsale.sendTransaction({value: amount, from: investor});

      const expectedTokensSold = amount.mul(RATE).mul(1.25);
      assert.eventValuesEqual(txResult.logs[0], 'TokenPurchase', {
         purchaser: investor,
         beneficiary: investor,
         value: amount,
         amount: expectedTokensSold
      });
      assert.deepEqual(await token.balanceOf(investor), investorTokenBalanceBefore.plus(expectedTokensSold));
      assert.deepEqual(await token.balanceOf(teamWallet), teamTokenBalanceBefore.minus(expectedTokensSold));
      assert.deepEqual(await crowdsale.weiRaised(), amount);
      assert.deepEqual(web3.eth.getBalance(teamWallet), teamWalletBalanceBefore.plus(amount));
    });
  });

  describe('Crowdsale is in second week', async function() {
    beforeEach(async function() {
      await blockchainTime.increaseTimeTo(crowdsaleArgs.openingTime + duration.weeks(1));
    });

    it('tokens should be sold with 15% bonus', async function() {
      const teamWalletBalanceBefore = web3.eth.getBalance(teamWallet);
      const teamTokenBalanceBefore = await token.balanceOf(teamWallet);
      const amount = ether(0.1);

      const txResult = await crowdsale.buyTokens(investor, {value: amount, from: investor});
      const expectedTokensSold = amount.mul(RATE).mul(1.15);
      assert.eventValuesEqual(txResult.logs[0], 'TokenPurchase', {
         purchaser: investor,
         beneficiary: investor,
         value: amount,
         amount: expectedTokensSold
      });
      assert.deepEqual(await token.balanceOf(investor), expectedTokensSold);
      assert.deepEqual(await token.balanceOf(teamWallet), teamTokenBalanceBefore.minus(expectedTokensSold));
      assert.deepEqual(await crowdsale.weiRaised(), amount);
      assert.deepEqual(web3.eth.getBalance(teamWallet), teamWalletBalanceBefore.plus(amount));
    });
  });

  describe('Crowdsale is in third week', async function() {
    beforeEach(async function() {
      await blockchainTime.increaseTimeTo(crowdsaleArgs.openingTime + duration.weeks(2));
    });

    it('tokens should be sold with 15% bonus', async function() {
      const teamWalletBalanceBefore = web3.eth.getBalance(teamWallet);
      const teamTokenBalanceBefore = await token.balanceOf(teamWallet);
      const amount = ether(0.1);

      const txResult = await crowdsale.buyTokens(investor, {value: amount, from: investor});
      const expectedTokensSold = amount.mul(RATE).mul(1.15);
      assert.eventValuesEqual(txResult.logs[0], 'TokenPurchase', {
         purchaser: investor,
         beneficiary: investor,
         value: amount,
         amount: expectedTokensSold
      });
      assert.deepEqual(await token.balanceOf(investor), expectedTokensSold);
      assert.deepEqual(await token.balanceOf(teamWallet), teamTokenBalanceBefore.minus(expectedTokensSold));
      assert.deepEqual(await crowdsale.weiRaised(), amount);
      assert.deepEqual(web3.eth.getBalance(teamWallet), teamWalletBalanceBefore.plus(amount));
    });
  });

  describe('Crowdsale is in fourth week', async function() {
    beforeEach(async function() {
      await blockchainTime.increaseTimeTo(crowdsaleArgs.openingTime + duration.weeks(3));
    });

    it('tokens should be sold with 10% bonus', async function() {
      const teamWalletBalanceBefore = web3.eth.getBalance(teamWallet);
      const teamTokenBalanceBefore = await token.balanceOf(teamWallet);
      const amount = ether(0.1);

      const txResult = await crowdsale.buyTokens(investor, {value: amount, from: investor});
      const expectedTokensSold = amount.mul(RATE).mul(1.1);
      assert.eventValuesEqual(txResult.logs[0], 'TokenPurchase', {
         purchaser: investor,
         beneficiary: investor,
         value: amount,
         amount: expectedTokensSold
      });
      assert.deepEqual(await token.balanceOf(investor), expectedTokensSold);
      assert.deepEqual(await token.balanceOf(teamWallet), teamTokenBalanceBefore.minus(expectedTokensSold));
      assert.deepEqual(await crowdsale.weiRaised(), amount);
      assert.deepEqual(web3.eth.getBalance(teamWallet), teamWalletBalanceBefore.plus(amount));
    });
  });

  describe('Crowdsale is in fifth week', async function() {
    beforeEach(async function() {
      await blockchainTime.increaseTimeTo(crowdsaleArgs.openingTime + duration.weeks(4));
    });

    it('tokens should be sold with 10% bonus', async function() {
      const teamWalletBalanceBefore = web3.eth.getBalance(teamWallet);
      const teamTokenBalanceBefore = await token.balanceOf(teamWallet);
      const amount = ether(0.1);

      const txResult = await crowdsale.buyTokens(investor, {value: amount, from: investor});
      const expectedTokensSold = amount.mul(RATE).mul(1.1);
      assert.eventValuesEqual(txResult.logs[0], 'TokenPurchase', {
         purchaser: investor,
         beneficiary: investor,
         value: amount,
         amount: expectedTokensSold
      });
      assert.deepEqual(await token.balanceOf(investor), expectedTokensSold);
      assert.deepEqual(await token.balanceOf(teamWallet), teamTokenBalanceBefore.minus(expectedTokensSold));
      assert.deepEqual(await crowdsale.weiRaised(), amount);
      assert.deepEqual(web3.eth.getBalance(teamWallet), teamWalletBalanceBefore.plus(amount));
    });
  });

  describe('Crowdsale is in sixth week', async function() {
    beforeEach(async function() {
      await blockchainTime.increaseTimeTo(crowdsaleArgs.openingTime + duration.weeks(5));
    });

    it('tokens should be sold with no bonus', async function() {
      const teamWalletBalanceBefore = web3.eth.getBalance(teamWallet);
      const teamTokenBalanceBefore = await token.balanceOf(teamWallet);
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
      assert.deepEqual(await token.balanceOf(teamWallet), teamTokenBalanceBefore.minus(expectedTokensSold));
      assert.deepEqual(await crowdsale.weiRaised(), amount);
      assert.deepEqual(web3.eth.getBalance(teamWallet), teamWalletBalanceBefore.plus(amount));
    });

    it('tokens should not be sold if allowance is less than available', async function() {
      await token.approve(crowdsale.address, 0, {from: teamWallet});

      await assert.evmThrows(crowdsale.buyTokens(investor, {value: ether(0.1), from: investor}));
    });

    it('crowdsale should end once main sale time runs out', async function() {
      await blockchainTime.increaseTimeTo(crowdsaleArgs.closingTime + duration.seconds(1));

      assert.equal(await crowdsale.hasClosed(), true);
    });
  });
});