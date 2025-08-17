<script>
  import { onMount } from "svelte";

  let cid = "";
  let FirstName = "";
  let LastName = "";
  let gpa = "";
  let program = "";
  let institution = "";
  let credID = "";
  let signature = "";
  let isNotFound = false;

  onMount(async () => {
    const hash = window.location.hash;
    const queryString = hash.split("?")[1];
    cid = new URLSearchParams(queryString).get("cid");

    if (!cid) {
      isNotFound = true;
    }
    try {
      const uri = `https://${import.meta.env.VITE_PINATA_GATEWAY}/ipfs/${cid}`;
      console.log(`uri: ${uri}`);
      const res = await fetch(uri, { method: "GET" });

      if (!res.ok) {
        throw new Error(`Failed: ${res.status}`);
      }

      const data = await res.json();
      FirstName = data["FirstName"];
      LastName = data["LastName"];
      program = data["program"];
      gpa = data["gpa"];
      institution = data["institution"];
      credID = data["credentialId"];
      signature = data["signature"];
    } catch (err) {
      isNotFound = true;
      console.error(err.message);
    }
  });
</script>

<main>
  {#if isNotFound}
    <div class="not-found">
      <h1>404 - Page Not Found</h1>
      <p>The requested certifiate does not exist.</p>
    </div>
  {:else}
    <div class="certificate">
      <h1>Certificates of Achievement</h1>
      <p>This is to certify that</p>
      <h2 class="student-name">{FirstName} {LastName}</h2>
      <p>has successfully completed the</p>
      <h3 class="program-name">{program} at {institution}</h3>
      <p class="credID">Cert ID: {credID}</p>
      <div class="signature">
        <p>Signature:</p>
        <p class="signature-line">{signature}</p>
      </div>
    </div>
  {/if}
</main>

<style>
  main {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 50px;
    background: #ecf0f1;
    min-height: 100vh;
  }

  .certificate {
    width: 800px;
    margin: 40px auto;
    padding: 40px;
    border: 10px solid #1e3a8a;
    border-radius: 15px;
    background: #0b2a6f;
    color: #ffffff;
    text-align: center;
    font-family: "Georgia", serif;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.35);
  }

  .student-name {
    font-size: 2rem;
    margin: 15px 0;
    font-weight: bold;
    color: #ffffff;
  }

  .program-name {
    font-size: 1.5rem;
    margin: 10px 0 20px 0;
    color: #dbeafe;
  }

  .credID {
    margin-top: 30px;
    font-style: italic;
    color: #e5e7eb;
  }

  .signature {
    margin-top: 50px;
  }

  .signature-line {
    max-width: 900px;
    white-space: normal;
    word-wrap: break-word;
    color: #f1f5f9;
  }

  .not-found {
    text-align: center;
    padding: 50px;
    color: #c0392b;
  }
</style>
