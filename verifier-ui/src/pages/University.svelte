<script>
  import { onMount } from "svelte";
  import { ethers, keccak256, toUtf8Bytes } from "ethers";
  import { CERT_REGISTRY_ABI } from "../lib/abi";
  import { PinataSDK } from "pinata";

  // form fields
  let studentID = "";
  let FirstName = "";
  let LastName = "";
  let program = "";
  let institution = "";
  let gpa = "";

  // state
  let provider;
  let contract;
  let pinata;
  let loading = false;

  const IS_LOCAL = import.meta.env.VITE_BLOCKCHAIN_NETWORK === "local";
  const CONTRACT_ADDR = import.meta.env.VITE_CONTRACT_ADDRESS;
  const PRIVATE_KEY = import.meta.env.VITE_PRIVATE_KEY;
  const EXPECTED_CHAIN_ID_ENV = import.meta.env.VITE_EXPECTED_CHAIN_ID || null;

  function parseExpectedChainId(val) {
    if (!val) return undefined;
    return String(val).startsWith("0x") ? parseInt(val, 16) : Number(val);
  }
  const EXPECTED_CHAIN_ID = parseExpectedChainId(EXPECTED_CHAIN_ID_ENV);
  const toHexChainId = (n) => "0x" + Number(n).toString(16);

  async function getReadProvider() {
    if (IS_LOCAL && PRIVATE_KEY) {
      return new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    }
    if (window.ethereum) {
      const p = new ethers.BrowserProvider(window.ethereum);
      if (EXPECTED_CHAIN_ID) {
        const net = await p.getNetwork();
        if (Number(net.chainId) !== Number(EXPECTED_CHAIN_ID)) {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: toHexChainId(EXPECTED_CHAIN_ID) }],
          });
        }
      }
      return p;
    }
    if (IS_LOCAL) return new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    throw new Error("No RPC or wallet found.");
  }

  async function getWriteSigner() {
    if (IS_LOCAL && PRIVATE_KEY) {
      const rpc = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
      return new ethers.Wallet(PRIVATE_KEY, rpc);
    }
    if (!window.ethereum) throw new Error("No wallet found in browser (MetaMask).");
    await window.ethereum.request({ method: "eth_requestAccounts" });
    const p = new ethers.BrowserProvider(window.ethereum);
    if (EXPECTED_CHAIN_ID) {
      const net = await p.getNetwork();
      if (Number(net.chainId) !== Number(EXPECTED_CHAIN_ID)) {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: toHexChainId(EXPECTED_CHAIN_ID) }],
        });
      }
    }
    return p.getSigner();
  }

  // main actions
  async function issue() {
    loading = true;
    try {
      const FullName = `${FirstName} ${LastName}`;
      const credentialId = ethers.solidityPackedKeccak256(["string", "string"], [studentID, FullName]);

      const certificate_info = {
        studentID,
        FirstName,
        LastName,
        program,
        institution,
        gpa,
        credentialId,
      };

      const signer = await getWriteSigner();

      const domain = {
        name: "CredentialChecker",
        version: "1",
        chainId: (await signer.provider.getNetwork()).chainId,
        verifyingContract: CONTRACT_ADDR,
      };

      const types = {
        Verify: [
          { name: "signer", type: "address" },
          { name: "message", type: "string" },
        ],
      };

      const signerAddress = await signer.getAddress();
      const value = { signer: signerAddress, message: JSON.stringify(certificate_info) };
      const signature = await signer.signTypedData(domain, types, value);

      certificate_info.signature = signature;
      const res = await pinata.upload.public.json(certificate_info);
      const cid = res.cid;

      const contentHash = keccak256(toUtf8Bytes(JSON.stringify(certificate_info)));

      const write = new ethers.Contract(CONTRACT_ADDR, CERT_REGISTRY_ABI, signer);
      await write.issue(credentialId, cid, contentHash, { gasLimit: 30_000_000 });

      console.log("Issued:", { credentialId, cid, contentHash });
      alert("Credential issued ✅");
    } catch (e) {
      console.error(e);
      alert(e?.message || String(e));
    } finally {
      loading = false;
    }
  }

  // init
  onMount(async () => {
    provider = await getReadProvider();
    const code = await provider.getCode(CONTRACT_ADDR);
    if (!code || code === "0x") {
      throw new Error("No contract deployed at this address on the current chain.");
    }
    contract = new ethers.Contract(CONTRACT_ADDR, CERT_REGISTRY_ABI, provider);
    pinata = new PinataSDK({ pinataJwt: import.meta.env.VITE_PINATA_JWT });
  });
</script>

<main style="max-width: 820px; margin: 2rem auto; font-family: system-ui, sans-serif; text-align:left;">
  <h2 style="margin:0 0 1rem 0;">Issue Student Credential</h2>

  <div style="display:grid; gap:0.75rem; margin:1rem 0;">
    <label style="display:grid; gap:0.35rem; font-weight:600;">
      Student ID
      <input bind:value={studentID} placeholder="e.g. S123456" style="width:100%; padding:0.5rem;" />
    </label>

    <label style="display:grid; gap:0.35rem; font-weight:600;">
      First Name
      <input bind:value={FirstName} style="width:100%; padding:0.5rem;" />
    </label>

    <label style="display:grid; gap:0.35rem; font-weight:600;">
      Last Name
      <input bind:value={LastName} style="width:100%; padding:0.5rem;" />
    </label>

    <label style="display:grid; gap:0.35rem; font-weight:600;">
      Program
      <input bind:value={program} style="width:100%; padding:0.5rem;" />
    </label>

    <label style="display:grid; gap:0.35rem; font-weight:600;">
      Institution
      <input bind:value={institution} style="width:100%; padding:0.5rem;" />
    </label>

    <label style="display:grid; gap:0.35rem; font-weight:600;">
      GPA
      <input bind:value={gpa} style="width:100%; padding:0.5rem;" />
    </label>

    <button on:click={issue} disabled={loading} style="padding:0.6em 1rem;">
      {loading ? "Issuing…" : "Issue"}
    </button>
  </div>
</main>
