<script lang="ts">
	import Section from '$lib/components/ui/Section.svelte';
	import { getContext } from 'svelte';
	import { lazyVideo, stagger, tilt } from '$lib/components/motion/actions';
	import { PROBLEMS } from '$lib/content/site';
	import { LANDING_DEFAULTS, listOr, type Landing } from '$lib/content/remote';
	const landing = getContext<Landing | undefined>('landing');
	const tiles = $derived(landing?.tiles ?? LANDING_DEFAULTS.tiles);
	const items = $derived(listOr(landing?.lists?.problems, PROBLEMS.items, (r) => ({ scene: r.a, answer: r.b })));
	import Motif from '$lib/components/ui/Motif.svelte';
	const scenes = ['tablet', 'camera', 'envelope', 'globe', 'head', 'bank'] as const;
	/** Six Tuesdays. The visitor finds theirs; the answer is under the card. */
</script>

<Section id="problems" eyebrow={PROBLEMS.eyebrow} title={PROBLEMS.title} voice="display" align="center" class="stack-top">
	<div use:stagger={70} class="scroll-in grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each items as p, i}
			{@const clip = tiles[`problem:${i + 1}`]}
			<article use:tilt={5} class="card spot ring-hover group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-2xl border border-line bg-surface-2 p-6 transition-[border-color,box-shadow] duration-300 hover:border-accent/50 hover:shadow-1">
				{#if clip}{#key clip}<video class="lazy dim absolute inset-0 h-full w-full object-cover" muted loop playsinline preload="none" use:lazyVideo={{ src: clip }} aria-hidden="true"></video>{/key}{/if}
				<div aria-hidden="true" class="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--color-surface-2)_35%,transparent),var(--color-surface-2)_72%)]"></div>
				<div class="relative flex items-start justify-between">
					<p class="label-mono text-ink-3">{String(i + 1).padStart(2, '0')}</p>
					<Motif kind={scenes[i % scenes.length]} class="h-14 w-14 text-danger opacity-80 transition-colors duration-500 group-hover:text-accent" />
				</div>
				<p class="relative mt-6 text-[18px] font-medium leading-snug text-ink">{p.scene}</p>
				<p class="relative mt-5 border-t border-line pt-4 text-[13.5px] leading-relaxed text-ink-2"><span class="label-mono mr-2 text-accent">What we do</span>{p.answer}</p>
			</article>
		{/each}
	</div>
</Section>

<style>
	.card { --dim: 0.36; }
	.card:hover :global(video.is-playing) { opacity: 0.4; }
</style>
