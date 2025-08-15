// Run with: truffle exec scripts/issue.js --network development
const CertRegistry = artifacts.require("CertRegistry");

module.exports = async function (callback) {
  try {
    const reg = await CertRegistry.deployed();

    // Paste from your pin.js output:
    const cid = "bafybeignk3h4m5kca7r7skgg53mtq2g2quyhlhbptewx2ivkbjggjb25iu";
    const contentHash = "0x287f131639a15f68be26505c6b1d682e7604db674e209fb708ac2dc14e631af0";
    const certId = "0x306f339c2ff94d6d36daaf6a0d98b8996dc7143bee6685af03c69c931f572d17";

    const accounts = await web3.eth.getAccounts();
    await reg.issue(certId, cid, contentHash, { from: accounts[0] });

    const c = await reg.get(certId);
    console.log("Issued. On-chain record:", {
      cid: c.cid,
      hash: c.contentHash,
      status: c.status.toString(), // 1 = Active
    });
    callback();
  } catch (e) {
    callback(e);
  }
};
