pragma solidity ^0.4.18;

import "../node_modules/zeppelin-solidity/contracts/crowdsale/CappedCrowdsale.sol";
import "../node_modules/zeppelin-solidity/contracts/crowdsale/FinalizableCrowdsale.sol";
import "../node_modules/zeppelin-solidity/contracts/token/MintableToken.sol";
import "./KeyrptoToken.sol";

contract KeyrptoCrowdsale is CappedCrowdsale, FinalizableCrowdsale {
  uint256 internal constant ONE_TOKEN = 1e18;

  uint256 public mainStartTime;
  uint256 public tokensSoldDuringPresale;

  function KeyrptoCrowdsale(
                  uint256 _startTime,
                  uint256 _mainStartTime,
                  uint256 _endTime,
                  uint256 _rate,
                  uint256 _cap,
                  address _wallet) public
    CappedCrowdsale(_cap)
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

  /*
   * @overrides Crowdsale#buyTokens
   * Changes:
   * - Added minimum purchase amount of 0.1 ETH
   * - Added extra restrictions during presale (max contribution of 2 ETH; total supply of 31.875M KYT)
   */
  function buyTokens(address beneficiary) public payable {
    require(msg.value >= 100 finney);
    require(beneficiary != address(0));
    require(validPurchase());

    uint256 weiAmount = msg.value;
    uint256 tokens = weiAmount.mul(getRate());
    if (presale()) {
      uint256 tokensAfterTransaction = token.balanceOf(beneficiary) + tokens;
      uint256 totalTokensAfterTransaction = token.totalSupply() + tokens;
      require(tokensAfterTransaction <= getRate().mul(2 ether));
      require(totalTokensAfterTransaction <= 31875000 * ONE_TOKEN);
    } else if (tokensSoldDuringPresale == 0) {
      tokensSoldDuringPresale = token.totalSupply();
    }

    // update state
    weiRaised = weiRaised.add(weiAmount);

    token.mint(beneficiary, tokens);
    TokenPurchase(msg.sender, beneficiary, weiAmount, tokens);

    forwardFunds();
  }

  function getRate() internal view returns (uint256) {
    return presale() ? rate.mul(5).div(4) : rate;
  }

  function presale() internal view returns (bool) {
    return now < mainStartTime;
  }

  function finalization() internal {
    KeyrptoToken(token).mintTeamTokens(tokensSoldDuringPresale);
    token.finishMinting();
    token.transferOwnership(wallet);
  }
}