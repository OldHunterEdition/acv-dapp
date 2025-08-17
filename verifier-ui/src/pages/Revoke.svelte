<script>
  import { onMount } from "svelte";
  import { ethers } from "ethers";
  import { CERT_REGISTRY_ABI } from "../lib/abi";

  let studentID = "";
  let FirstName = "";
  let LastName = "";
  let reason = "";

  let provider;
  let contract;
  let loading = false;
  let result = null;

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
  async function revoke() {
    loading = true;
    result = null;
    try {
      if (!studentID || !FirstName || !LastName) {
        throw new Error("Fill Student ID, First Name, and Last Name.");
      }
      if (!reason.trim()) {
        throw new Error("Please provide a revoke reason.");
      }

      const certId = makeCertId(studentID, FirstName, LastName);

      const code = await provider.getCode(CONTRACT_ADDR);
      if (!code || code === "0x") throw new Error("No contract at VITE_CONTRACT_ADDRESS on this chain.");

      const existsActive = await contract.isActive(certId);
      const statusBefore = await contract.statusOf(certId);
      if (!existsActive) {
        result = {
          ok: false,
          details: [`certId: ${certId}`, `Status before: ${statusBefore} (not active)`, "Nothing to revoke (already revoked or never issued)."],
        };
        return;
      }

      const signer = await getWriteSigner();
      const issuerRole = await contract.ISSUER_ROLE();
      const signerAddr = await signer.getAddress();
      const hasRole = await contract.hasRole(issuerRole, signerAddr);
      if (!hasRole) {
        throw new Error(`Signer ${signerAddr} lacks ISSUER_ROLE and cannot revoke.`);
      }

      const write = new ethers.Contract(CONTRACT_ADDR, CERT_REGISTRY_ABI, signer);
      const tx = await write.revoke(certId, reason, { gasLimit: 500_000 });
      const rcpt = await tx.wait();

      const statusAfter = await contract.statusOf(certId);
      const isActiveAfter = await contract.isActive(certId);

      result = {
        ok: rcpt?.status === 1 && !isActiveAfter,
        txHash: tx.hash,
        statusAfter: Number(statusAfter),
        isActiveAfter,
        details: [`certId: ${certId}`, `Tx hash: ${tx.hash}`, `Revoke reason: ${reason}`, `Status after: ${statusAfter}`, `Active after revoke: ${isActiveAfter ? "YES" : "NO"}`],
      };
    } catch (e) {
      result = { ok: false, details: [e?.message || String(e)] };
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
  });
</script>

<main style="max-width: 820px; margin: 2rem auto; font-family: system-ui, sans-serif; text-align:left;">
  <h2 style="margin:0 0 1rem 0;">Revoke Certificate</h2>

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
      Reason
      <input bind:value={reason} style="width:100%; padding:0.5rem;" />
    </label>

    <button on:click={revoke} disabled={loading} style="padding:0.6em 1rem;">
      {loading ? "Revoking…" : "Revoke"}
    </button>
  </div>

  {#if result}
    <section style="border-radius:12px; padding:1rem; margin-top:1rem; border:1px solid #333; background:#000; color:#fff; text-align:left;">
      <h3 style="margin:0 0 0.5rem 0;">
        {result.ok ? "✅ Revoked" : "❌ Revoke failed"}
      </h3>
      <ul style="margin-top:0.75rem; padding-left:1.25rem;">
        {#each result.details as line}
          <li style="word-break:break-all;">{line}</li>
        {/each}
      </ul>
      {#if result.txHash}
        <div style="margin-top:0.5rem; font-size:0.9rem; word-break:break-all;">
          <strong>Tx:</strong>
          {result.txHash}
        </div>
      {/if}
    </section>
  {/if}
</main>
