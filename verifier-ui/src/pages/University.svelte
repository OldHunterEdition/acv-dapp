<script>
  import { onMount } from "svelte";
  import { ethers } from "ethers";
  import { CERT_REGISTRY_ABI } from "../lib/abi";

  let provider;
  let contract;
  let credentialID = "";
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

  async function issue(credentialID) {}

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
    console.log("code: ", code);
  });
</script>

<main
  style="max-width: 800px; margin: 2rem auto; font-family: system-ui, sans-serif;"
>
  <div style="display:grid; gap:0.75rem; margin:1rem 0;">
    <label>
      Cert ID
      <input
        bind:value={credentialID}
        placeholder="0x.."
        style="width:100%; padding:0.5rem;"
      />
    </label>

    <button on:click={issue} disabled={loading} style="padding:0.6em 1rem;">
      {loading ? "Issuing" : "Issue"}
    </button>
  </div>
</main>
