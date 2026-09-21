<script lang="ts">
	import '../app.css';
	// The two faces the first paint waits on (the hero line and its serif aside); the rest stream in by unicode-range.
	import interLatin from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';
	import serifItalic from '@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2?url';
	import Nav from '$lib/components/marketing/Nav.svelte';
	import Footer from '$lib/components/marketing/Footer.svelte';
	let { children } = $props();
</script>

<svelte:head>
	<link rel="preload" href={interLatin} as="font" type="font/woff2" crossorigin="anonymous" />
	<link rel="preload" href={serifItalic} as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

<!-- the mark draws itself while the page settles; lifts after 1.4 s; never shown under reduced motion -->
<div class="preloader" aria-hidden="true">
	<div class="flex flex-col items-center gap-4">
		<svg class="mark" width="72" height="72" viewBox="0 0 64 64" fill="none">
			<rect x="6" y="6" width="52" height="52" rx="15" stroke="#3B9CFF" stroke-width="3.25" pathLength="1" />
			<path d="M14 44V30a18 18 0 0 1 36 0v8" stroke="#E6EBF5" stroke-width="3" stroke-linecap="round" pathLength="1" />
			<path d="M20.5 50V30a11.5 11.5 0 0 1 23 0v12" stroke="#E6EBF5" stroke-width="3" stroke-linecap="round" pathLength="1" />
			<path d="M26.5 46V30.5a5.5 5.5 0 0 1 11 0v13" stroke="#E6EBF5" stroke-width="3" stroke-linecap="round" pathLength="1" />
			<path d="M32 36v17" stroke="#E6EBF5" stroke-width="3" stroke-linecap="round" pathLength="1" />
		</svg>
		<span class="word text-[22px] font-semibold tracking-tight text-ink">host<span class="text-gradient">OS</span></span>
	</div>
</div>

<Nav />
<main id="main" class="min-h-screen">
	{@render children()}
</main>
<Footer />
