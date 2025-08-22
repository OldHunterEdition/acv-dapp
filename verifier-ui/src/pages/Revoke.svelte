<script>
  import { ethers } from "ethers";
  import { CERT_REGISTRY_ABI } from "../lib/abi";

  let account = "";

  let fields = [
    {
      studentID: "",
      FirstName: "",
      LastName: "",
      reason: "",
    },
  ];

  let provider;
  let contract;
  let loading = false;
  let result = null;
  let isConnected = false;
  let chainID;

  async function getProvider(eth) {
    if (eth) {
      const p = new ethers.BrowserProvider(eth);
      return p;
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
    if (!isConnected) {
      window.alert("Connect to wallet first");
      return;
    }
    loading = true;
    result = null;

    let certIds = [];
    let reasons = [];

    // create  signer
    let signer = await provider.getSigner();

    try {
      // check contract deployed & create contract instance
      const code = await provider.getCode(
        chainID === 11155111
          ? import.meta.env.VITE_CONTRACT_ADDRESS
          : import.meta.env.VITE_LOCAL_CONTRACT_ADDRESS
      );
      if (!code || code === "0x")
        throw new Error("No contract at VITE_CONTRACT_ADDRESS on this chain.");
      contract = new ethers.Contract(
        chainID === 11155111
          ? import.meta.env.VITE_CONTRACT_ADDRESS
          : import.meta.env.VITE_LOCAL_CONTRACT_ADDRESS,
        CERT_REGISTRY_ABI,
        signer
      );

      // signer must have ISSUER_ROLE
      const issuerRole = await contract.ISSUER_ROLE();
      const signerAddr = await signer.getAddress();
      const hasRole = await contract.hasRole(issuerRole, signerAddr);
      if (!hasRole) {
        throw new Error(
          `Signer ${signerAddr} lacks ISSUER_ROLE and cannot revoke.`
        );
      }

      // validations
      for (const field of fields) {
        if (!field.studentID || !field.FirstName || !field.LastName) {
          throw new Error("Fill Student ID, First Name, and Last Name.");
        }

        if (!field.reason.trim()) {
          throw new Error("Please provide a revoke reason.");
        }

        const certId = makeCertId(
          field.studentID,
          field.FirstName,
          field.LastName
        );

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

        // add reasons & credentialIDs
        certIds.push(certId);
        reasons.push(field.reason);
      }

      // send tx
      const tx = await contract.batchRevoke(certIds, reasons, {
        gasLimit: 500_000,
      });
      const rcpt = await tx.wait();
      console.log(`certIDs: ${JSON.stringify(certIds)}`);
      console.log(`reasons: ${JSON.stringify(reasons)}`);

      result = {
        ok: rcpt?.status === 1,
        txHash: tx.hash,
        details: [
          `certId: ${certIds}`,
          `Tx hash: ${tx.hash}`,
          `Revoke reasons: ${reasons}`,
        ],
      };
    } catch (e) {
      result = { ok: false, details: [e?.message || String(e)] };
    } finally {
      loading = false;
    }
  }

  async function connectWallet() {
    const eth = typeof window !== "undefined" ? window["ethereum"] : null;
    provider = await getProvider(eth);
    const signer = await provider.getSigner();
    account = await signer.getAddress();
    chainID = Number((await provider.getNetwork()).chainId);
    isConnected = true;
    eth.on("accountsChanged", (accounts) => {
      account = accounts[0] || "";
    });
    eth.on("chainChanged", (chainId) => {
      // window.location.reload();
      provider = new ethers.BrowserProvider(window["ethereum"]);
      chainID = Number(chainId);
    });
  }

  function addField() {
    fields = [
      ...fields,
      {
        studentID: "",
        FirstName: "",
        LastName: "",
        reason: "",
      },
    ];
  }

  function removeFields() {
    if (fields.length > 0) {
      fields = fields.slice(0, -1);
    }
  }
</script>

<main
  style="max-width: 820px; margin: 2rem auto; font-family: system-ui, sans-serif; text-align:left;"
>
  {#if account}
    <p>Connected Wallet: {account}</p>
    <p>chainId: {chainID}</p>
  {:else}
    <button on:click={connectWallet}>Connect Wallet</button>
  {/if}
  <h2 style="margin:0 0 1rem 0;">Revoke Certificate</h2>

  <div style="display:grid; gap:0.75rem; margin:1rem 0;">
    <ul class="field-list">
      {#each fields as field}
        <li class="field-item">
          <label style="display:grid; gap:0.35rem; font-weight:600;">
            Student ID
            <input
              bind:value={field.studentID}
              placeholder="e.g. S123456"
              style="width:100%; padding:0.5rem;"
            />
          </label>

          <label style="display:grid; gap:0.35rem; font-weight:600;">
            First Name
            <input
              bind:value={field.FirstName}
              style="width:100%; padding:0.5rem;"
            />
          </label>

          <label style="display:grid; gap:0.35rem; font-weight:600;">
            Last Name
            <input
              bind:value={field.LastName}
              style="width:100%; padding:0.5rem;"
            />
          </label>

          <label style="display:grid; gap:0.35rem; font-weight:600;">
            Reason
            <input
              bind:value={field.reason}
              style="width:100%; padding:0.5rem;"
            />
          </label>
        </li>
      {/each}
    </ul>

    <button type="button" on:click={addField}>+ Add field</button>
    <button type="button" on:click={removeFields}>remove last field</button>
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

<style>
  .field-list {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 1rem;
  }
  .field-item {
    border: 1px solid #ddd;
    padding: 0.75rem;
    border-radius: 0.75rem;
    background: #fafafa;
  }
</style>
