<script lang="ts">
	import '../app.css';
	import Nav from '$lib/components/marketing/Nav.svelte';
	import Footer from '$lib/components/marketing/Footer.svelte';
	let { children } = $props();
</script>

<Nav />
<main id="main" class="min-h-screen">
	{@render children()}
</main>
<Footer />
