<script>
  import { onMount } from "svelte";
  import { ethers } from "ethers";
  import { CERT_REGISTRY_ABI } from "../lib/abi";

  let studentID = "";
  let FirstName = "";
  let LastName = "";
  let reason = "";
  let account = "";

  let provider;
  let contract;
  let loading = false;
  let result = null;

  const EXPECTED_CHAIN_ID = 11155111;
  const CONTRACT_ADDR = import.meta.env.VITE_CONTRACT_ADDRESS;
  const NETWORK_KIND = import.meta.env.VITE_BLOCKCHAIN_NETWORK;
  const PRIVATE_KEY = import.meta.env.VITE_PRIVATE_KEY;

  async function getProvider() {
    if (NETWORK_KIND == "local") {
      return new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    } else {
      const eth = typeof window !== "undefined" ? window["ethereum"] : null;
      if (eth) {
        const p = new ethers.BrowserProvider(eth);
        const net = await p.getNetwork();
        if (
          EXPECTED_CHAIN_ID &&
          Number(net.chainId) !== Number(EXPECTED_CHAIN_ID)
        ) {
          try {
            await eth.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: "0x" + EXPECTED_CHAIN_ID.toString(16) }],
            });
          } catch (err) {
            if (err.code === 4902) {
              await eth.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: "0xaa36a7",
                    chainName: "Sepolia Testnet",
                    nativeCurrency: {
                      name: "SepoliaETH",
                      symbol: "ETH",
                      decimals: 18,
                    },
                    rpcUrls: ["https://sepolia.infura.io/v3/YOUR_INFURA_KEY"],
                    blockExplorerUrls: ["https://sepolia.etherscan.io/"],
                  },
                ],
              });
            }
          }
        }
        eth.on("accountsChanged", (accounts) => {
          console.log(`accounts: ${accounts}`);

          account = accounts[0] || "";
        });
        eth.on("chainChanged", () => window.location.reload());
        return p;
      }
      throw new Error("No RPC or wallet found.");
    }
  }

  function makeCertId(studentID, first, last) {
    const full = `${first} ${last}`;
    return ethers.solidityPackedKeccak256(
      ["string", "string"],
      [studentID, full]
    );
  }

  async function revoke() {
    loading = true;
    result = null;
    try {
      // validations
      if (!studentID || !FirstName || !LastName) {
        throw new Error("Fill Student ID, First Name, and Last Name.");
      }
      if (!reason.trim()) {
        throw new Error("Please provide a revoke reason.");
      }
      if (!(NETWORK_KIND == "local" && PRIVATE_KEY)) {
        throw new Error("Revoking requires local mode with VITE_PRIVATE_KEY.");
      }

      const certId = makeCertId(studentID, FirstName, LastName);

      // create  signer
      let signer;
      if (import.meta.env.VITE_BLOCKCHAIN_NETWORK == "local") {
        signer = new ethers.Wallet(import.meta.env.VITE_PRIVATE_KEY, provider);
      } else {
        signer = await provider.getSigner();
      }

      // check contract deployed & create contract instance
      const code = await provider.getCode(CONTRACT_ADDR);
      if (!code || code === "0x")
        throw new Error("No contract at VITE_CONTRACT_ADDRESS on this chain.");
      contract = new ethers.Contract(CONTRACT_ADDR, CERT_REGISTRY_ABI, signer);

      // current status
      const existsActive = await contract.isActive(certId);
      const statusBefore = await contract.statusOf(certId);
      if (!existsActive) {
        result = {
          ok: false,
          details: [
            `certId: ${certId}`,
            `Status before: ${statusBefore} (not active)`,
            "Nothing to revoke (already revoked or never issued).",
          ],
        };
        return;
      }

      // signer must have ISSUER_ROLE
      const issuerRole = await contract.ISSUER_ROLE();
      const signerAddr = await signer.getAddress();
      const hasRole = await contract.hasRole(issuerRole, signerAddr);
      if (!hasRole) {
        throw new Error(
          `Signer ${signerAddr} lacks ISSUER_ROLE and cannot revoke.`
        );
      }

      // send tx
      const tx = await contract.revoke(certId, reason /* string */, {
        gasLimit: 500_000,
      });
      const rcpt = await tx.wait();

      // read status after
      const statusAfter = await contract.statusOf(certId);
      const isActiveAfter = await contract.isActive(certId);

      result = {
        ok: rcpt?.status === 1 && !isActiveAfter,
        txHash: tx.hash,
        statusAfter: Number(statusAfter),
        isActiveAfter,
        details: [
          `certId: ${certId}`,
          `Tx hash: ${tx.hash}`,
          `Revoke reason: ${reason}`,
          `Status after: ${statusAfter}`,
          `Active after revoke: ${isActiveAfter ? "YES" : "NO"}`,
        ],
      };
    } catch (e) {
      result = { ok: false, details: [e?.message || String(e)] };
    } finally {
      loading = false;
    }
  }

  async function connectWallet() {
    provider = await getProvider();
    const signer = await provider.getSigner();
    account = await signer.getAddress();
  }
</script>

<main
  style="max-width: 820px; margin: 2rem auto; font-family: system-ui, sans-serif; text-align:left;"
>
  {#if account}
    <p>Connected Wallet: {account}</p>
  {:else}
    <button on:click={connectWallet}>Connect Wallet</button>
  {/if}
  <h2 style="margin:0 0 1rem 0;">Revoke Certificate</h2>

  <div style="display:grid; gap:0.75rem; margin:1rem 0;">
    <label style="display:grid; gap:0.35rem; font-weight:600;">
      Student ID
      <input
        bind:value={studentID}
        placeholder="e.g. S123456"
        style="width:100%; padding:0.5rem;"
      />
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
    <section
      style="border-radius:12px; padding:1rem; margin-top:1rem; border:1px solid #333; background:#000; color:#fff; text-align:left;"
    >
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
