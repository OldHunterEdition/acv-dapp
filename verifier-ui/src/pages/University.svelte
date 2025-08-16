<script>
  import { onMount } from "svelte";
  import { ethers, keccak256 } from "ethers";
  import { CERT_REGISTRY_ABI } from "../lib/abi";
  import { PinataSDK } from "pinata";

  let studentID = "";
  let FirstName = "";
  let LastName = "";
  let program = "";
  let institution = "";
  let gpa = 4.0;

  let provider;
  let contract;
  let pinata;
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

  async function issue() {
    // fill out the certificate fields
    let FullName = FirstName + " " + LastName;
    let credentialId = ethers.solidityPackedKeccak256(
      ["string", "string"],
      [studentID, FullName]
    );
    console.log(`credentialID: ${credentialId}`);
    // TODO: add status to the certificate_info to indicate revoked status or not
    const certificate_info = {
      studentID,
      FirstName,
      LastName,
      program,
      institution,
      gpa,
      credentialId,
    };

    // sign the certificate using the institution's certificate
    let signer;
    if (import.meta.env.VITE_BLOCKCHAIN_NETWORK == "local") {
      signer = new ethers.Wallet(import.meta.env.VITE_PRIVATE_KEY, provider);
    }

    const domain = {
      name: "CredentialChecker",
      version: "1",
      chainId: (await provider.getNetwork()).chainId,
      verifyingContract: import.meta.env.VITE_CONTRACT_ADDRESS,
    };

    // const types = {
    //   Verify: [
    //     { name: "studentID", type: "string" },
    //     { name: "FirstName", type: "string" },
    //     { name: "LastName", type: "string" },
    //     { name: "program", type: "string" },
    //     { name: "institution", type: "string" },
    //     { name: "gpa", type: "string" },
    //     { name: "credentialId", type: "string" },
    //   ],
    // };
    const types = {
      Verify: [
        { name: "signer", type: "address" },
        { name: "message", type: "string" },
      ],
    };

    const signerAddress = await signer.getAddress();
    const value = {
      signer: signerAddress,
      message: JSON.stringify(certificate_info),
    };
    const signature = await signer.signTypedData(domain, types, value);

    // Verify the signature by calling verification method
    // const result = await contract.verify(
    //   signerAddress,
    //   value.message,
    //   signature
    // );
    // console.log(`verified address: ${result}`);

    // pin the certificate fields to pinata to get cid
    certificate_info["signature"] = signature;
    const res = await pinata.upload.public.json(certificate_info);
    // console.log(`res: ${JSON.stringify(res)}`);

    // take the cid from res and call issue method from smart contract
    const cid = res.cid;
    const contentHash = keccak256(signature);
    const credentialID = credentialId;
    contract = new ethers.Contract(
      import.meta.env.VITE_CONTRACT_ADDRESS,
      CERT_REGISTRY_ABI,
      signer
    );
    const result = await contract.issue(credentialID, cid, contentHash, {
      gasLimit: 30000000,
    });
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
    pinata = new PinataSDK({ pinataJwt: import.meta.env.VITE_PINATA_JWT });
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
      program
      <input bind:value={program} style="width:100%; padding:0.5rem;" />
    </label>
    <label>
      Institution
      <input bind:value={institution} style="width:100%; padding:0.5rem;" />
    </label>
    <label>
      GPA
      <input bind:value={gpa} style="width:100%; padding:0.5rem;" />
    </label>
    <button on:click={issue} disabled={loading} style="padding:0.6em 1rem;">
      {loading ? "Issuing" : "Issue"}
    </button>
  </div>
</main>
