<script>
  import QRCode from "qrcode";

  let cid = "";
  let qrcodeDataUrl = "";
  let certificateUrl = "";
  let loading = false;

  async function generateCertificateLink() {
    loading = true;
    certificateUrl = `${import.meta.env.VITE_DOMAIN}#/student?cid=${cid}`;
    qrcodeDataUrl = await QRCode.toDataURL(certificateUrl);
    loading = false;
  }
</script>

<main
  style="max-width: 820px; margin: 2rem auto; font-family: system-ui, sans-serif; text-align:left;"
>
  <div style="display:grid; gap:0.75rem; margin:1rem 0;">
    <label>
      cid:
      <input
        bind:value={cid}
        placeholder="0x.."
        style="width:100%; padding:0.5rem;"
      />
    </label>
    <button
      on:click={generateCertificateLink}
      disabled={loading}
      style="padding:0.6em 1rem;"
    >
      {loading ? "Generating" : "Generate"}
    </button>
    {#if qrcodeDataUrl}
      <div class="qr-code">
        <img src={qrcodeDataUrl} alt="QR Code Verification" />
        <p>Scan to Verify</p>
        <p>{certificateUrl}</p>
      </div>
    {/if}
  </div>
</main>

<style>
  .qr-code {
    margin-top: 40px;
    text-align: center;
  }

  .qr-code img {
    width: 120px;
    height: 120px;
  }
</style>
