pragma solidity ^0.4.19;

import "../node_modules/zeppelin-solidity/contracts/crowdsale/validation/TimedCrowdsale.sol";
import "../node_modules/zeppelin-solidity/contracts/crowdsale/emission/AllowanceCrowdsale.sol";

contract KeyrptoCrowdsale2 is TimedCrowdsale, AllowanceCrowdsale {
  function KeyrptoCrowdsale2(
                  uint256 _openingTime,
                  uint256 _closingTime,
                  uint256 _rate,
                  address _wallet,
                  ERC20 _token) public
    Crowdsale(_rate, _wallet, _token)
    TimedCrowdsale(_openingTime, _closingTime)
    AllowanceCrowdsale(_wallet)
  {
      // Empty constructor
  }

  /**
   * @dev Extend parent behavior adding pricing tiers
   * @param _weiAmount Amount of wei contributed
   */
  function _getTokenAmount(uint256 _weiAmount) internal view returns (uint256) {
    return _weiAmount.mul(getRateIncludingBonus());
  }
  
  function getRateIncludingBonus() internal view returns (uint256) {
    if (now < openingTime + 1 weeks) {
      return rate.mul(125).div(100);
    } else if (now < openingTime + 3 weeks) {
      return rate.mul(115).div(100);
    } else if (now < openingTime + 5 weeks) {
      return rate.mul(110).div(100);
    } else {
      return rate;
    }
  }
}