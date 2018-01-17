pragma solidity ^0.4.18;

import "../node_modules/zeppelin-solidity/contracts/crowdsale/FinalizableCrowdsale.sol";
import "../node_modules/zeppelin-solidity/contracts/token/MintableToken.sol";
import "./KeyrptoToken.sol";

contract KeyrptoCrowdsale is FinalizableCrowdsale {
  uint256 internal constant ONE_TOKEN = 1e18;
  uint256 internal constant MILLION_TOKENS = 1e6 * ONE_TOKEN;

  mapping (address => bool) public whitelist;

  uint256 public mainStartTime;
  uint256 public extraTokensMintedDuringPresale;

  function KeyrptoCrowdsale(
                  uint256 _startTime,
                  uint256 _mainStartTime,
                  uint256 _endTime,
                  uint256 _rate,
                  address _wallet) public
    Crowdsale(_startTime, _endTime, _rate, _wallet)
  {
    require(_startTime < _mainStartTime && _mainStartTime < _endTime);

    mainStartTime = _mainStartTime;

    KeyrptoToken(token).setTeamWallet(_wallet);
    KeyrptoToken(token).pause();
  }

  function createTokenContract() internal returns (MintableToken) {
    return new KeyrptoToken();
  }

  /*
   * Disable fallback function
   */
  function() external payable {
    revert();
  }

  function updateRate(uint256 _rate) external onlyOwner {
    require(_rate > 0);
    require(now < endTime);

    rate = _rate;
  }

  function whitelist(address _address) external onlyOwner {
    whitelist[_address] = true;
  }

  function blacklist(address _address) external onlyOwner {
    delete whitelist[_address];
  }

  /*
   * @overrides Crowdsale#buyTokens
   * Changes:
   * - Pass number of tokens to be created and beneficiary for purchase validation
   * - After presale has ended, record number of extra tokens minted during presale
   */
  function buyTokens(address _beneficiary) public payable {
    require(_beneficiary != address(0));

    uint256 weiAmount = msg.value;
    uint256 tokens = weiAmount.mul(getRate());

    require(validPurchase(tokens, _beneficiary));

    if (extraTokensMintedDuringPresale == 0 && !presale()) {
      extraTokensMintedDuringPresale = token.totalSupply() / 5;
    }

    // update state
    weiRaised = weiRaised.add(weiAmount);

    token.mint(_beneficiary, tokens);
    TokenPurchase(msg.sender, _beneficiary, weiAmount, tokens);

    forwardFunds();
  }

  /*
   * @overrides Crowdsale#validPurchase
   * Changes:
   * - Added restriction to sell only to whitelisted addresses
   * - Added minimum purchase amount of 0.1 ETH
   * - Added presale restriction: max contribution of 2 ETH per address
   * - Added presale restriction: max total supply of 31.875M KYT
   */
  function validPurchase(uint256 _tokens, address _beneficiary) internal view returns (bool) {
    uint256 totalSupplyAfterTransaction = token.totalSupply() + _tokens;

    if (presale()) {
      bool withinPerAddressLimit = (token.balanceOf(_beneficiary) + _tokens) <= getRate().mul(2 ether);
      bool withinTotalSupplyLimit = totalSupplyAfterTransaction <= 31875000 * ONE_TOKEN;
      if (!withinPerAddressLimit || !withinTotalSupplyLimit) {
        return false;
      }
    }

    bool aboveMinContribution = msg.value >= 100 finney;
    bool whitelistedSender = whitelisted(msg.sender);
    bool withinCap = totalSupplyAfterTransaction <= tokenSupplyCap();
    return aboveMinContribution && whitelistedSender && withinCap && super.validPurchase();
  }

  function whitelisted(address _address) public view returns (bool) {
    return whitelist[_address];
  }

  function getRate() internal view returns (uint256) {
    return presale() ? rate.mul(5).div(4) : rate;
  }

  function presale() internal view returns (bool) {
    return now < mainStartTime;
  }

  /*
   * @overrides Crowdsale#hasEnded
   * Changes:
   * - Added token cap logic based on token supply
   */
  function hasEnded() public view returns (bool) {
    bool capReached = token.totalSupply() >= tokenSupplyCap();
    return capReached || super.hasEnded();
  }

  function tokenSupplyCap() public view returns (uint256) {
    return 510 * MILLION_TOKENS + extraTokensMintedDuringPresale;
  }

  function finalization() internal {
    KeyrptoToken(token).mintTeamTokens(extraTokensMintedDuringPresale);
    token.finishMinting();
    token.transferOwnership(wallet);
  }
}