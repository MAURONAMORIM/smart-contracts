const KeyrptoCrowdsale = artifacts.require("KeyrptoCrowdsale");

module.exports = function(deployer) {
  const startTime = 1516456800;         // 2018-01-20T14:00:00+00:00
  const mainStartTime = 1517061600;     // 2018-01-27T14:00:00+00:00
  const endTime = 1519740000;           // 2018-02-27T14:00:00+00:00
  const rate = 105000;                  // 1 ETH = 1050 USD = 105 000 KYT, can be updated later
  const wallet = "0xcB6139abD6C0c8285CAC91E878C92FFEAfb2df5E";
  deployer.deploy(KeyrptoCrowdsale, startTime, mainStartTime, endTime, rate, wallet);
};