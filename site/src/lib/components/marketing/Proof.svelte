<script lang="ts">
	import Section from '$lib/components/ui/Section.svelte';
	import { getContext } from 'svelte';
	import { countUp, lazyVideo, reveal, stagger, tilt } from '$lib/components/motion/actions';
	import { LANDING_DEFAULTS, type Landing } from '$lib/content/remote';
	const landing = getContext<Landing | undefined>('landing');
	const tiles = $derived(landing?.tiles ?? LANDING_DEFAULTS.tiles);
	const sparks = ['M0 30 L12 28 L24 26 L36 20 L48 18 L60 12 L72 10 L84 6 L96 4 L108 2 L120 2', 'M0 6 L12 10 L24 8 L36 14 L48 18 L60 20 L72 24 L84 26 L96 27 L108 28 L120 30', 'M0 30 L20 30 L20 22 L40 22 L40 16 L60 16 L60 12 L80 12 L80 6 L100 6 L100 2 L120 2'];
	import { PROOF } from '$lib/content/site';
	/** Numbers first, dated, named where allowed. A quote without a number is wallpaper; none here. */
</script>

<Section id="proof" eyebrow={PROOF.eyebrow} title={PROOF.title} tone="surface" voice="serif" align="right">
	<div use:stagger={90} class="scroll-in grid grid-cols-1 gap-4 md:grid-cols-3">
		{#each PROOF.cases as c, i}
			{@const clip = tiles[`proof:${i + 1}`]}
			<article use:tilt={4} class="card ring-hover relative overflow-hidden rounded-2xl border border-line bg-surface-2 p-6" style={`--spot:${c.hue}`}>
				{#if clip}{#key clip}<video class="lazy dim absolute inset-0 h-full w-full object-cover" muted loop playsinline preload="none" use:lazyVideo={{ src: clip }} aria-hidden="true"></video>{/key}{/if}
				<div aria-hidden="true" class="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--color-surface-2)_35%,transparent),var(--color-surface-2)_70%)]"></div>
				<div aria-hidden="true" class="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-25 blur-3xl" style={`background:${c.hue}`}></div>
				<p class="relative font-mono text-[56px] font-bold leading-none tracking-tight text-ink" style={`color:color-mix(in oklab, ${c.hue} 70%, white)`}><span use:countUp={c.figure}>{c.figure}{c.suffix}</span></p>
				<p class="relative label-mono mt-2 text-ink-3">{c.label}</p>
				<svg use:reveal viewBox="0 0 120 32" class="spark relative mt-3 h-8 w-full" aria-hidden="true" preserveAspectRatio="none"><path d={sparks[i % sparks.length]} fill="none" stroke={c.hue} stroke-width="2" pathLength="1" stroke-linecap="round" /></svg>
				<p class="relative mt-4 text-[14.5px] leading-relaxed text-ink-2">{c.line}</p>
				<p class="relative mt-5 border-t border-line pt-4 text-[12.5px] text-ink-3">{c.who} · {c.when}</p>
			</article>
		{/each}
	</div>
</Section>

<style>
	.card { --dim: 0.32; }
</style>
