<script>
  import Verifier from "./pages/Verifier.svelte";
  import University from "./pages/University.svelte";

  let currentPage = "university"; // default page
</script>

<nav>
  <button on:click={() => (currentPage = "university")}>University</button>
  <button on:click={() => (currentPage = "verifier")}>Verifier</button>
</nav>

<main>
  {#if currentPage === "university"}
    <University />
  {:else if currentPage === "verifier"}
    <Verifier />
  {/if}
</main>
