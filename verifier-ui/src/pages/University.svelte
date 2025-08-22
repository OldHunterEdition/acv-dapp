<script>
  import { onMount } from "svelte";
  import { ethers, keccak256, toUtf8Bytes } from "ethers";
  import { CERT_REGISTRY_ABI } from "../lib/abi";
  import { PinataSDK } from "pinata";

  let fields = [
    {
      studentID: "",
      FirstName: "",
      LastName: "",
      program: "",
      institution: "",
      gpa: "",
    },
  ];

  let provider;
  let pinata;
  let loading = false;
  let isConnected = false;
  let chainID;
  let account = "";

  async function getProvider(eth) {
    if (eth) {
      const p = new ethers.BrowserProvider(eth);
      return p;
    }
  }

  async function issue() {
    if (!isConnected) {
      window.alert("Connect to wallet first");
      return;
    }
    loading = true;
    let credentialIds = [];
    let cids = [];
    let contentHashes = [];

    let signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();

    const code = await provider.getCode(
      chainID === 11155111
        ? import.meta.env.VITE_CONTRACT_ADDRESS
        : import.meta.env.VITE_LOCAL_CONTRACT_ADDRESS
    );
    if (!code || code === "0x") {
      throw new Error(
        "No contract deployed at this address on the current chain."
      );
    }

    const domain = {
      name: "CredentialChecker",
      version: "1",
      chainId: (await provider.getNetwork()).chainId,
      verifyingContract: import.meta.env.VITE_CONTRACT_ADDRESS,
    };

    const types = {
      Verify: [
        { name: "signer", type: "address" },
        { name: "message", type: "string" },
      ],
    };

    try {
      for (const field of fields) {
        const FullName = `${field.FirstName} ${field.LastName}`;
        const credentialID = ethers.solidityPackedKeccak256(
          ["string", "string"],
          [field.studentID, FullName]
        );
        const certificate_info = {
          studentID: field.studentID,
          FirstName: field.FirstName,
          LastName: field.LastName,
          program: field.program,
          institution: field.institution,
          gpa: field.gpa,
          credentialID,
        };

        // sign the certificate
        const value = {
          signer: signerAddress,
          message: JSON.stringify(certificate_info),
        };
        const signature = await signer.signTypedData(domain, types, value);
        certificate_info.signature = signature;

        // pin the certificate to IPFS
        const res = await pinata.upload.public.json(certificate_info);
        const cid = res.cid;

        // compute content hash
        const contentHash = keccak256(
          toUtf8Bytes(JSON.stringify(certificate_info))
        );

        // add the cid, contenHash & credentialID to the list
        credentialIds.push(credentialID);
        cids.push(cid);
        contentHashes.push(contentHash);
      }

      const write = new ethers.Contract(
        chainID === 11155111
          ? import.meta.env.VITE_CONTRACT_ADDRESS
          : import.meta.env.VITE_LOCAL_CONTRACT_ADDRESS,
        CERT_REGISTRY_ABI,
        signer
      );

      const tx = await write.batchIssue(credentialIds, cids, contentHashes, {
        gasLimit: 30_000_000,
      });

      console.log(`result: ${JSON.stringify(tx)}`);
      await tx.wait();
    } catch (e) {
      console.error(e);
      alert(e?.message || String(e));

      if (e.info?.error?.message) {
        console.log("Revert reason:", e.info.error.message);
      } else if (e.shortMessage) {
        console.log("Revert reason:", e.shortMessage);
      } else {
        console.log("Full error:", e);
      }
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
        program: "",
        institution: "",
        gpa: "",
      },
    ];
  }

  function removeFields() {
    if (fields.length > 0) {
      fields = fields.slice(0, -1);
    }
  }

  onMount(async () => {
    pinata = new PinataSDK({ pinataJwt: import.meta.env.VITE_PINATA_JWT });
  });
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
  <h2 style="margin:0 0 1rem 0;">Issue Student Credential</h2>

  <div style="display:grid; gap:0.75rem; margin:1rem 0;">
    <ul class="field-list">
      {#each fields as field, i}
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
            Program
            <input
              bind:value={field.program}
              style="width:100%; padding:0.5rem;"
            />
          </label>

          <label style="display:grid; gap:0.35rem; font-weight:600;">
            Institution
            <input
              bind:value={field.institution}
              style="width:100%; padding:0.5rem;"
            />
          </label>

          <label style="display:grid; gap:0.35rem; font-weight:600;">
            GPA
            <input bind:value={field.gpa} style="width:100%; padding:0.5rem;" />
          </label>
        </li>
      {/each}
    </ul>

    <button type="button" on:click={addField}>+ Add field</button>
    <button type="button" on:click={removeFields}>remove last field</button>
    <button on:click={issue} disabled={loading} style="padding:0.6em 1rem;">
      {loading ? "Issuing…" : "Issue"}
    </button>
  </div>
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
