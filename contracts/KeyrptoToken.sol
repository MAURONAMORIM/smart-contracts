pragma solidity ^0.4.18;

import '../node_modules/zeppelin-solidity/contracts/token/MintableToken.sol';
import '../node_modules/zeppelin-solidity/contracts/lifecycle/Pausable.sol';

contract KeyrptoToken is MintableToken, Pausable {
  string public constant name = "Keyrpto Token";
  string public constant symbol = "KYT";
  uint8 public constant decimals = 18;
  uint256 internal constant MILLION_TOKENS = 1e6 * 1e18;

  address public teamWallet;
  bool public teamTokensMinted = false;
  uint256 public circulationStartTime;

  function KeyrptoToken(address _teamWallet) public {
    require(_teamWallet != address(0));
    teamWallet = _teamWallet;
  }

  function mintTeamTokens(uint256 _presaleTokens) public onlyOwner canMint {
    require(!teamTokensMinted);

    teamTokensMinted = true;
    uint256 totalExtraTokenSupply = 490 * MILLION_TOKENS;
    uint256 extraTokensMintedDuringPresale = _presaleTokens / 5;

    mint(teamWallet, totalExtraTokenSupply.sub(extraTokensMintedDuringPresale));
  }

  /*
   * @overrides Pausable#unpause
   * Change: store the time when it was first unpaused
   */
  function unpause() onlyOwner whenPaused public {
    if (circulationStartTime == 0) {
      circulationStartTime = now;
    }

    super.unpause();
  }

  /*
   * @overrides BasicToken#transfer
   * Changes:
   * - added whenNotPaused modifier
   * - added validation that teamWallet balance must not fall below amount of locked tokens
   */
  function transfer(address _to, uint256 _value) public whenNotPaused returns (bool) {
    require(validTransfer(msg.sender, _value));
    return super.transfer(_to, _value);
  }

  /*
   * @overrides StandardToken#transferFrom
   * Changes:
   * - added whenNotPaused modifier
   * - added validation that teamWallet balance must not fall below amount of locked tokens
   */
  function transferFrom(address _from, address _to, uint256 _value) public whenNotPaused returns (bool) {
    require(validTransfer(_from, _value));
    return super.transferFrom(_from, _to, _value);
  }

  function validTransfer(address _from, uint256 _amount) internal view returns (bool) {
    if (_from != teamWallet) {
      return true;
    }

    uint256 balanceAfterTransfer = balanceOf(_from).sub(_amount);
    return balanceAfterTransfer >= minimumTeamWalletBalance();
  }

  /*
   * 100M tokens in teamWallet are locked for 6 months
   * 200M tokens in teamWallet are locked for 12 months
   */
  function minimumTeamWalletBalance() internal view returns (uint256) {
    if (now < circulationStartTime + 26 weeks) {
      return 300 * MILLION_TOKENS;
    } else if (now < circulationStartTime + 1 years) {
      return 200 * MILLION_TOKENS;
    } else {
      return 0;
    }
  }
}