<script>
  import Router from "svelte-spa-router";
  import Home from "./Home.svelte";
  import Student from "./pages/Student.svelte";

  const routes = {
    "/": Home,
    "/student": Student,
  };
</script>

<Router {routes} />
