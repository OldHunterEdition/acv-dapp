const CertRegistry = artifacts.require("CertRegistry");

module.exports = async function (deployer, network, accounts) {
  const admin = accounts[0];
  await deployer.deploy(CertRegistry, admin);
};
