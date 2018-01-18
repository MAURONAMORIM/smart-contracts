"use strict";

// Imports
const assertExtra = require('./helpers/assert');
assert.evmThrows = assertExtra.evmThrows;
assert.eventValuesEqual = assertExtra.eventValuesEqual;
const BigNumber = web3.BigNumber;
const blockchainTime = require('./helpers/time');
const duration = blockchainTime.duration;

// Contracts
const KeyrptoToken = artifacts.require('KeyrptoToken');

// Constants
const MILLION_TOKENS = new BigNumber('1e+24');

contract('KeyrptoToken', function([contractOwner, teamWallet, investor, investor2, investor3]) {
  let token;

  beforeEach(async function() {
    token = await KeyrptoToken.new(teamWallet, {from: contractOwner});
    await token.setTeamWallet(teamWallet, {from: contractOwner});
  });

  it('should have correct state after deployment', async function() {
    assert.equal(await token.name(), 'Keyrpto Token');
    assert.equal(await token.symbol(), 'KYT');
    assert.equal(await token.decimals(), 18);
    assert.equal(await token.teamWallet(), teamWallet);
    assert.equal(await token.paused(), true);
  });

  it('should not allow to change team wallet', async function() {
    await assert.evmThrows(token.setTeamWallet(investor, {from: investor2}));
    await assert.evmThrows(token.setTeamWallet(investor3, {from: contractOwner}));
  });

  it('fallback function should throw', async function() {
    await assert.evmThrows(token.sendTransaction({value: 1, from: investor}));
  });

  describe('Minting of team tokens', async function() {
    it('should be allowed for contractOwner and should mint correct amount', async function() {
      const tokensSoldDuringPreSale = 255000 + 63750;
      const tokensSoldDuringPublicSale = 89412314789;
      await token.mint(investor, tokensSoldDuringPreSale, {from: contractOwner});
      await token.mint(investor2, tokensSoldDuringPublicSale, {from: contractOwner});
      const totalSupplyBefore = await token.totalSupply();

      const txResult = await token.mintTeamTokens(63750, {from: contractOwner});

      const expectedTeamTokens = MILLION_TOKENS.times(490).minus(63750);
      assert.eventValuesEqual(txResult.logs[0], 'Mint', {
         to: teamWallet,
         amount: expectedTeamTokens
      });
      assert.equal(await token.teamTokensMinted(), true);
      const expectedTotalSupply = totalSupplyBefore.plus(expectedTeamTokens);
      assert.deepEqual(await token.totalSupply(), expectedTotalSupply);
    });

    it('should be forbidden for all others', async function() {
      await assert.evmThrows(token.mintTeamTokens(1000000, {from: investor}));
    });

    it('should be forbidden for contractOwner the second time', async function() {
      await token.mintTeamTokens(1000000, {from: contractOwner});

      await assert.evmThrows(token.mintTeamTokens(1000000, {from: contractOwner}));
    });
  });

  describe('Update of circulation start time', async function() {
    it('should happen first time transfers are unpaused', async function() {
      // First unpause should update circulation start time
      await token.unpause({from: contractOwner});

      const expectedCirculationStartTime = blockchainTime.latestTime();
      assert.equal(await token.circulationStartTime(), expectedCirculationStartTime);

      // Second unpause should not update it
      await token.pause({from: contractOwner});
      await blockchainTime.increaseTimeTo(blockchainTime.latestTime() + duration.days(1));

      await token.unpause({from: contractOwner});

      assert.equal(await token.circulationStartTime(), expectedCirculationStartTime);
    });

    it('should be impossible for non-owner', async function() {
      await assert.evmThrows(token.unpause({from: investor}));
    });
  });

  describe('Burning of tokens', async function() {
    beforeEach(async function() {
      await token.mint(investor, 1000, {from: contractOwner});
      await token.mintTeamTokens(0, {from: contractOwner});
      await token.finishMinting();
    });

    it('should be allowed for contract owner', async function() {
      const totalSupplyBefore = await token.totalSupply();
      const investorBalanceBefore = await token.balanceOf(investor);

      const txResult = await token.burn(investor, 127, {from: contractOwner});

      assert.eventValuesEqual(txResult.logs[0], 'Burn', {
         burnedFrom: investor,
         value: new BigNumber(127)
      });
      assert.deepEqual(await token.totalSupply(), totalSupplyBefore.sub(127));
      assert.deepEqual(await token.balanceOf(investor), investorBalanceBefore.sub(127));
    });

    it('should be impossible for address that does not hold tokens', async function() {
      await assert.evmThrows(token.burn(investor3, 1, {from: contractOwner}));
    });

    it('should be impossible for non-owner', async function() {
      await assert.evmThrows(token.burn(investor, 1, {from: investor}));
    });
  });

  describe('Token transfers', async function() {
    beforeEach(async function() {
      await token.mint(investor, 1000, {from: contractOwner});
      await token.mint(investor2, 10000, {from: contractOwner});
      await token.mintTeamTokens(0, {from: contractOwner});
      await token.finishMinting();
      await blockchainTime.increaseTimeTo(blockchainTime.latestTime() + duration.weeks(4));
      await token.unpause({from: contractOwner});
      await token.approve(investor2, 10000, {from: investor});
    });

    it('should be forbidden when paused', async function() {
      await token.pause({from: contractOwner});

      await assert.evmThrows(token.transfer(investor2, 157, {from: investor}));
      await assert.evmThrows(token.transferFrom(investor, investor2, 333, {from: investor2}));
    });

    it('should be allowed when unpaused', async function() {
      const txResult1 = await token.transfer(investor2, 157, {from: investor});
      assert.eventValuesEqual(txResult1.logs[0], 'Transfer', {
         from: investor,
         to: investor2,
         value: new BigNumber(157)
      });

      const txResult2 = await token.transferFrom(investor, investor2, 333, {from: investor2});
      assert.eventValuesEqual(txResult2.logs[0], 'Transfer', {
         from: investor,
         to: investor2,
         value: new BigNumber(333)
      });
    });

    it('should respect 300M team token locking for 6 months', async function() {
      await assert.evmThrows(token.transfer(investor3, MILLION_TOKENS.times(191), {from: teamWallet}));

      const txResult = await token.transfer(investor3, MILLION_TOKENS.times(189), {from: teamWallet});
      assert.eventValuesEqual(txResult.logs[0], 'Transfer', {
         from: teamWallet,
         to: investor3,
         value: MILLION_TOKENS.times(189)
      });

      await assert.evmThrows(token.transfer(investor, MILLION_TOKENS.times(2), {from: teamWallet}));
    });

    it('should respect 200M team token locking for 1 year', async function() {
      await blockchainTime.increaseTimeTo(blockchainTime.latestTime() + duration.weeks(26));
      await assert.evmThrows(token.transfer(investor3, MILLION_TOKENS.times(291), {from: teamWallet}));
      await token.transfer(investor3, MILLION_TOKENS.times(100), {from: teamWallet});

      const txResult = await token.transfer(investor3, MILLION_TOKENS.times(189), {from: teamWallet});
      assert.eventValuesEqual(txResult.logs[0], 'Transfer', {
         from: teamWallet,
         to: investor3,
         value: MILLION_TOKENS.times(189)
      });

      await assert.evmThrows(token.transfer(investor, MILLION_TOKENS.times(2), {from: teamWallet}));
    });

    it('should be allowed in full for team tokens in 1 year', async function() {
      await blockchainTime.increaseTimeTo(blockchainTime.latestTime() + duration.years(1));
      const allTeamTokens = await token.balanceOf(teamWallet);

      const txResult = await token.transfer(investor3, allTeamTokens, {from: teamWallet});
      assert.eventValuesEqual(txResult.logs[0], 'Transfer', {
         from: teamWallet,
         to: investor3,
         value: allTeamTokens
      });
    });
  });
});