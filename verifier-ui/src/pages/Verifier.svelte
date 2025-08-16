<script>
  import { onMount } from "svelte";
  import { ethers, keccak256 } from "ethers";
  import { CERT_REGISTRY_ABI } from "../lib/abi";

  let studentID = "";
  let FirstName = "";
  let LastName = "";
  let program = "";
  let institution = "";
  let gpa = "";

  let provider;
  let contract;
  let loading = false;
  let result = null;

  const EXPECTED_CHAIN_ID = 1337;
  const CONTRACT_ADDR = import.meta.env.VITE_CONTRACT_ADDRESS;
  const NETWORK_KIND = import.meta.env.VITE_BLOCKCHAIN_NETWORK;
  const PRIVATE_KEY = import.meta.env.VITE_PRIVATE_KEY;

  function toHex(v) {
    return typeof v === "string" ? v : ethers.hexlify(v);
  }

  function buildMessageObject(gpaValue, credentialId) {
    return {
      studentID,
      FirstName,
      LastName,
      program,
      institution,
      gpa: gpaValue,
      credentialId,
    };
  }

  async function getProvider() {
    if (NETWORK_KIND == "local") {
      return new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    } else {
      const eth = typeof window !== "undefined" ? window["ethereum"] : null;
      if (eth) {
        const p = new ethers.BrowserProvider(eth);
        const net = await p.getNetwork();
        const need = EXPECTED_CHAIN_ID;
        if (need && Number(net.chainId) !== Number(need)) {
          try {
            await eth.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: "0x" + need.toString(16) }],
            });
          } catch (_) {}
        }
        return p;
      }
      throw new Error("No RPC or wallet found.");
    }
  }

  async function getOnchainRecord(credentialID) {
    const c = await contract.get(credentialID);
    return {
      issuer: c.issuer,
      cid: c.cid,
      contentHash: toHex(c.contentHash),
      issuedAt: Number(c.issuedAt),
      revokedAt: Number(c.revokedAt),
      status: Number(c.status),
    };
  }

  async function signMessageJson(jsonStr, signer) {
    const net = await provider.getNetwork();
    const domain = {
      name: "CredentialChecker",
      version: "1",
      chainId: net.chainId,
      verifyingContract: CONTRACT_ADDR,
    };
    const types = {
      Verify: [
        { name: "signer", type: "address" },
        { name: "message", type: "string" },
      ],
    };
    const signerAddr = await signer.getAddress();
    const value = { signer: signerAddr, message: jsonStr };
    return signer.signTypedData(domain, types, value);
  }

  async function verify() {
    loading = true;
    result = null;
    try {
      if (!studentID || !FirstName || !LastName || !program || !institution || gpa === "") {
        throw new Error("Please fill all fields: Student ID, First/Last Name, Program, Institution, GPA.");
      }
      if (!(NETWORK_KIND == "local" && PRIVATE_KEY)) {
        throw new Error("Requires local mode with VITE_PRIVATE_KEY available.");
      }

      // Recompute credentialId
      const FullName = `${FirstName} ${LastName}`;
      const credentialId = ethers.solidityPackedKeccak256(["string", "string"], [studentID, FullName]);

      // Read on-chain record
      const rec = await getOnchainRecord(credentialId);
      const onchainHash = rec.contentHash.toLowerCase();

      // Re-sign locally with the institution private key
      const signer = new ethers.Wallet(PRIVATE_KEY, provider);

      const candidates = [];
      const gpaNumber = !isNaN(Number(gpa)) ? Number(gpa) : null;
      if (gpaNumber !== null) {
        candidates.push(JSON.stringify(buildMessageObject(gpaNumber, credentialId)));
      }
      candidates.push(JSON.stringify(buildMessageObject(gpa, credentialId)));

      let matchedSig = null;
      const attempts = [];
      for (const msg of candidates) {
        const sig = await signMessageJson(msg, signer);
        const sigHash = keccak256(sig).toLowerCase();
        // attempts.push(`Tried GPA=${JSON.parse(msg).gpa} → keccak256(sig)=${sigHash}`);
        if (sigHash === onchainHash) {
          matchedSig = sig;
          break;
        }
      }

      const ok = !!matchedSig;
      const details = [`credentialId: ${credentialId}`, `on-chain contentHash: ${onchainHash}`, ...attempts, ok ? "Match: YES" : "Match: NO"];

      result = {
        ok,
        details,
        onchain: {
          issuer: rec.issuer,
          cid: rec.cid,
          status: rec.status,
          issuedAt: rec.issuedAt,
          revokedAt: rec.revokedAt,
        },
      };
    } catch (e) {
      result = { ok: false, details: [e?.message || String(e)] };
    } finally {
      loading = false;
    }
  }

  onMount(async () => {
    provider = await getProvider();
    const code = await provider.getCode(CONTRACT_ADDR);
    if (!code || code === "0x") {
      throw new Error("No contract deployed at this address on the current chain.");
    }
    contract = new ethers.Contract(CONTRACT_ADDR, CERT_REGISTRY_ABI, provider);
  });
</script>

<main style="max-width: 820px; margin: 2rem auto; font-family: system-ui, sans-serif; text-align:left;">
  <h2 style="margin:0 0 1rem 0;">Verify Student Credential</h2>

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

    <button on:click={verify} disabled={loading} style="padding:0.6em 1rem;">
      {loading ? "Verifying…" : "Verify"}
    </button>
  </div>

  {#if result}
    <section style="border-radius:12px; padding:1rem; margin-top:1rem; border:1px solid #333; background:#000; color:#fff; text-align:left;">
      <h3 style="margin:0 0 0.5rem 0;">
        {result.ok ? "✅ Valid credential" : "❌ Verification failed"}
      </h3>

      {#if result.onchain}
        <div style="font-size:0.9rem; margin:0.25rem 0;">
          <div><strong>Issuer:</strong> {result.onchain.issuer}</div>
          {#if result.onchain.cid}
            <div><strong>CID:</strong> {result.onchain.cid}</div>
          {/if}
          <div><strong>Status:</strong> {result.onchain.status}</div>
        </div>
      {/if}

      <ul style="margin-top:0.75rem; padding-left:1.25rem;">
        {#each result.details as line}
          <li style="word-break:break-all;">{line}</li>
        {/each}
      </ul>
    </section>
  {/if}
</main>
