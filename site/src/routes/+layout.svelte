<script lang="ts">
	import '../app.css';
	// The one font the first paint waits on; the rest stream in by unicode-range.
	import interLatin from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';
	import Nav from '$lib/components/marketing/Nav.svelte';
	import Footer from '$lib/components/marketing/Footer.svelte';
	let { children } = $props();
</script>

<svelte:head>
	<link rel="preload" href={interLatin} as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

<Nav />
<main id="main" class="min-h-screen">
	{@render children()}
</main>
<Footer />
