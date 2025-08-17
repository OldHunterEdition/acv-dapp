<script>
  import { onMount } from "svelte";
  import { ethers, keccak256, toUtf8Bytes } from "ethers";
  import { CERT_REGISTRY_ABI } from "../lib/abi";
  import { PinataSDK } from "pinata";

  let studentID = "";
  let FirstName = "";
  let LastName = "";
  let program = "";
  let institution = "";
  let gpa = "";

  let provider;
  let pinata;
  let loading = false;
  let account = "";

  async function getProvider() {
    if (import.meta.env.VITE_BLOCKCHAIN_NETWORK == "local") {
      return new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    } else {
      const eth = typeof window !== "undefined" ? window["ethereum"] : null;
      if (eth) {
        const p = new ethers.BrowserProvider(eth);
        const net = await p.getNetwork();
        const chainId = 11155111;
        if (chainId && Number(net.chainId) !== Number(chainId)) {
          try {
            await eth.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: "0x" + chainId.toString(16) }],
            });
          } catch (err) {
            /* ignored */
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

  async function issue() {
    loading = true;
    try {
      const FullName = `${FirstName} ${LastName}`;
      const credentialId = ethers.solidityPackedKeccak256(
        ["string", "string"],
        [studentID, FullName]
      );

      const certificate_info = {
        studentID,
        FirstName,
        LastName,
        program,
        institution,
        gpa,
        credentialId,
      };

      let signer;
      if (import.meta.env.VITE_BLOCKCHAIN_NETWORK == "local") {
        signer = new ethers.Wallet(import.meta.env.VITE_PRIVATE_KEY, provider);
      } else {
        signer = await provider.getSigner();
      }

      const code = await provider.getCode(
        import.meta.env.VITE_CONTRACT_ADDRESS
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

      const signerAddress = await signer.getAddress();
      console.log(`signerAddress: ${signerAddress}`);
      const value = {
        signer: signerAddress,
        message: JSON.stringify(certificate_info),
      };
      const signature = await signer.signTypedData(domain, types, value);

      // Attach signature, pin to Pinata to obtain CID
      certificate_info.signature = signature;
      const res = await pinata.upload.public.json(certificate_info);

      // Store on-chain: contentHash = keccak256(signature)
      const cid = res.cid;
      const contentHash = keccak256(
        toUtf8Bytes(JSON.stringify(certificate_info))
      );

      const write = new ethers.Contract(
        import.meta.env.VITE_CONTRACT_ADDRESS,
        CERT_REGISTRY_ABI,
        signer
      );

      await write.issue(credentialId, cid, contentHash, {
        gasLimit: 30_000_000,
      });
      console.log("Issued:", { credentialId, cid, contentHash });
    } catch (e) {
      console.error(e);
      alert(e?.message || String(e));
    } finally {
      loading = false;
    }
  }

  async function connectWallet() {
    provider = await getProvider();
    const signer = await provider.getSigner();
    account = await signer.getAddress();
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
  {:else}
    <button on:click={connectWallet}>Connect Wallet</button>
  {/if}
  <h2 style="margin:0 0 1rem 0;">Issue Student Credential</h2>

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
