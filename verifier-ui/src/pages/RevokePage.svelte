<script>
  import { onMount } from "svelte";
  import { ethers, keccak256 } from "ethers";
  import { CERT_REGISTRY_ABI } from "../lib/abi";

  let studentID = "";
  let FirstName = "";
  let LastName = "";
  let reason = "";

  let provider;
  let contract;
  let loading = false;

  async function getProvider() {
    if (import.meta.env.VITE_BLOCKCHAIN_NETWORK == "local") {
      return new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    } else {
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const net = await provider.getNetwork();
        const chainId = 1337;
        if (chainId && Number(net.chainId) !== Number(chainId)) {
          try {
            await window.ethereum.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: "0x" + chainId.toString(16) }],
            });
          } catch (_) {
            /* ignored */
          }
        }
        return provider;
      }
      throw new Error("No RPC or wallet found.");
    }
  }

  async function revoke() {
    let FullName = FirstName + " " + LastName;
    let credentialId = ethers.solidityPackedKeccak256(
      ["string", "string"],
      [studentID, FullName]
    );

    // revoker signer
    let signer;
    if (import.meta.env.VITE_BLOCKCHAIN_NETWORK == "local") {
      signer = new ethers.Wallet(import.meta.env.VITE_PRIVATE_KEY, provider);
    }

    // call the contract revoke method
    contract = new ethers.Contract(
      import.meta.env.VITE_CONTRACT_ADDRESS,
      CERT_REGISTRY_ABI,
      signer
    );
    const result = await contract.revoke(credentialId, reason);
    console.log(`result: ${JSON.stringify(result)}`);
  }

  onMount(async () => {
    provider = await getProvider();
    const code = await provider.getCode(import.meta.env.VITE_CONTRACT_ADDRESS);
    if (!code || code === "0x") {
      throw new Error(
        "No contract deployed at this address on the current chain."
      );
    }
    contract = new ethers.Contract(
      import.meta.env.VITE_CONTRACT_ADDRESS,
      CERT_REGISTRY_ABI,
      provider
    );
  });
</script>

<main
  style="max-width: 800px; margin: 2rem auto; font-family: system-ui, sans-serif;"
>
  <div style="display:grid; gap:0.75rem; margin:1rem 0;">
    <label>
      Student ID
      <input
        bind:value={studentID}
        placeholder="0x.."
        style="width:100%; padding:0.5rem;"
      />
    </label>
    <label>
      First Name
      <input bind:value={FirstName} style="width:100%; padding:0.5rem;" />
    </label>
    <label>
      Last Name
      <input bind:value={LastName} style="width:100%; padding:0.5rem;" />
    </label>
    <label>
      reason:
      <input bind:value={reason} style="width:100%; padding:0.5rem;" />
    </label>
    <button on:click={revoke} disabled={loading} style="padding:0.6em 1rem;">
      {loading ? "Revoking" : "Revoke"}
    </button>
  </div>
</main>
