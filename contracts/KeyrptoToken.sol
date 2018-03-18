pragma solidity ^0.4.18;

import '../node_modules/zeppelin-solidity/contracts/token/ERC20/MintableToken.sol';
import '../node_modules/zeppelin-solidity/contracts/lifecycle/Pausable.sol';

contract KeyrptoToken is MintableToken, Pausable {
  string public constant name = "Keyrpto Token";
  string public constant symbol = "KYT";
  uint8 public constant decimals = 18;
  uint256 internal constant MILLION_TOKENS = 1e6 * 1e18;

  address public teamWallet;
  bool public teamTokensMinted = false;
  uint256 public circulationStartTime;

  event Burn(address indexed burnedFrom, uint256 value);

  function KeyrptoToken() public {
    paused = true;
  }

  function setTeamWallet(address _teamWallet) public onlyOwner canMint {
    require(teamWallet == address(0));
    require(_teamWallet != address(0));

    teamWallet = _teamWallet;
  }

  function mintTeamTokens(uint256 _extraTokensMintedDuringPresale) public onlyOwner canMint {
    require(!teamTokensMinted);

    teamTokensMinted = true;
    mint(teamWallet, (490 * MILLION_TOKENS).sub(_extraTokensMintedDuringPresale));
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

  /*
   * Copy of BurnableToken#burn
   * Changes:
   * - only allow owner to burn tokens and burn from given address, not msg.sender
   */
  function burn(address _from, uint256 _value) external onlyOwner {
    require(_value <= balances[_from]);

    balances[_from] = balances[_from].sub(_value);
    totalSupply_ = totalSupply_.sub(_value);
    Burn(_from, _value);
  }
}