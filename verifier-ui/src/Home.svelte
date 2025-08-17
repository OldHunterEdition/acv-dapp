<script>
  import Verifier from "./pages/Verifier.svelte";
  import University from "./pages/University.svelte";
  import RevokePage from "./pages/RevokePage.svelte";
  import Certificate from "./pages/Certificate.svelte";

  let currentPage = "university"; // default page
</script>

<nav>
  <button on:click={() => (currentPage = "university")}>University</button>
  <button on:click={() => (currentPage = "verifier")}>Verifier</button>
  <button on:click={() => (currentPage = "revoke")}>Revoke</button>
  <button on:click={() => (currentPage = "certificate")}>Certificate</button>
</nav>

<main>
  {#if currentPage === "university"}
    <University />
  {:else if currentPage === "verifier"}
    <Verifier />
  {:else if currentPage === "revoke"}
    <RevokePage />
  {:else if currentPage == "certificate"}
    <Certificate />
  {/if}
</main>
