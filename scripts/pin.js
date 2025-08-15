// scripts/pin.js  (CommonJS)
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Blob } = require("buffer");
const { PinataSDK } = require("pinata");
const { keccak256 } = require("ethers");
// const Web3 = require("web3");

// Node 20+ has global File. For Node 18, fall back to undici's File.
const File = global.File || require("undici").File;

async function main() {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error("Missing PINATA_JWT in .env");

  const pinata = new PinataSDK({
    pinataJwt: jwt,
    // optional but nice if you have one:
    // pinataGateway: "YOUR-GATEWAY.mypinata.cloud",
  });

  // 1) Read your local PDF and hash it
  const pdfPath = path.resolve(__dirname, "../assets/cert.pdf");
  const pdfBytes = fs.readFileSync(pdfPath);
  const contentHash = keccak256(pdfBytes);
  console.log("PDF keccak256:", contentHash);

  // 2) Build the “folder” as an array of File objects
  const metadata = {
    schema: "edu.cert.v1",
    name: "Bachelor of Science",
    institution: "Example University",
    program: "Computer Science",
    dateIssued: "2025-06-01",
    file: "certificate.pdf",
    hash: contentHash,
  };

  const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], {
    type: "application/json",
  });
  const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });

  const files = [new File([metadataBlob], "metadata.json", { type: "application/json" }), new File([pdfBlob], "certificate.pdf", { type: "application/pdf" })];

  // 3) Upload the folder with the new SDK
  const res = await pinata.upload.public.fileArray(files); // => { cid, ... }
  const folderCid = res.cid;
  console.log("Folder CID:", folderCid);
  console.log("Metadata URL:", `https://gateway.pinata.cloud/ipfs/${folderCid}/metadata.json`);
  console.log("PDF URL:", `https://gateway.pinata.cloud/ipfs/${folderCid}/certificate.pdf`);

  // 4) Derive certId like Solidity (string + bytes32)
  const { solidityPackedKeccak256 } = require("ethers");
  const certId = solidityPackedKeccak256(["string", "bytes32"], [folderCid, contentHash]);

  console.log("certId:", certId);

  // Save latest values so the UI can read them
  const outPath = path.resolve(__dirname, "../build/pin-latest.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ cid: folderCid, contentHash, certId }, null, 2));
  console.log("Wrote:", outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
