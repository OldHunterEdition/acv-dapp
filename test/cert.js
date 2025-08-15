const CertRegistry = artifacts.require("CertRegistry");
const { keccak256 } = web3.utils;

contract("CertRegistry", (accounts) => {
  it("issues and reads a cert", async () => {
    const reg = await CertRegistry.deployed();
    const cid = "bafy...demo";
    // replace with real PDF hash later
    const fileHash = web3.utils.keccak256("dummy bytes");

    const certId = web3.utils.soliditySha3({ type: "string", value: cid }, { type: "bytes32", value: fileHash });

    await reg.issue(certId, cid, fileHash, { from: accounts[0] });

    const c = await reg.get(certId);
    const Status = { None: "0", Active: "1", Revoked: "2" };

    assert.equal(c.cid, cid);
    assert.equal(await reg.isActive(certId), true);
  });
});
