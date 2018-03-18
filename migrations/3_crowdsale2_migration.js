const KeyrptoCrowdsale2 = artifacts.require("KeyrptoCrowdsale2");

module.exports = function(deployer) {
  const openingTime = 1521986400;         // 2018-03-25T14:00:00+00:00
  const closingTime = 1526220000;         // 2018-05-13T14:00:00+00:00
  const rate = 70000;                     // 1 ETH = 70 000 KYT
  const wallet = "0xcB6139abD6C0c8285CAC91E878C92FFEAfb2df5E";
  const token = "0x532843f66375d5257ea34f723c6c2723ccf7b7a2";
  deployer.deploy(KeyrptoCrowdsale2, openingTime, closingTime, rate, wallet, token);
};
