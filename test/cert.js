const CertRegistry = artifacts.require("CertRegistry");
const { keccak256 } = web3.utils;

contract("CertRegistry", (accounts) => {
  it("issues and reads a cert", async () => {
    const reg = await CertRegistry.deployed();
    // from pin.js output
    const cid = "bafybeignk3h4m5kca7r7skgg53mtq2g2quyhlhbptewx2ivkbjggjb25iu";
    const fileHash = "0x287f131639a15f68be26505c6b1d682e7604db674e209fb708ac2dc14e631af0";

    const certId = web3.utils.soliditySha3({ type: "string", value: cid }, { type: "bytes32", value: fileHash });

    await reg.issue(certId, cid, fileHash, { from: accounts[0] });

    const c = await reg.get(certId);
    const Status = { None: "0", Active: "1", Revoked: "2" };

    assert.equal(c.cid, cid);
    assert.equal(await reg.isActive(certId), true);
  });
});
