<script lang="ts">
	import Section from '$lib/components/ui/Section.svelte';
	import { getContext } from 'svelte';
	import { lazyVideo, reveal, stagger } from '$lib/components/motion/actions';
	import Motif from '$lib/components/ui/Motif.svelte';
	import { THIRTY_DAYS } from '$lib/content/site';
	import { LANDING_DEFAULTS, type Landing } from '$lib/content/remote';
	const landing = getContext<Landing | undefined>('landing');
	const tiles = $derived(landing?.tiles ?? LANDING_DEFAULTS.tiles);
</script>

<Section id="start" eyebrow={THIRTY_DAYS.eyebrow} title={THIRTY_DAYS.title} tone="surface" voice="grotesk">
	<div use:reveal class="draw relative mb-6 hidden h-10 md:block" aria-hidden="true">
		<svg viewBox="0 0 1200 40" class="h-full w-full" fill="none" preserveAspectRatio="none">
			<path d="M150 20 H1050" stroke="var(--color-line-strong)" stroke-width="1.5" pathLength="1" />
			<path d="M150 20 H1050" stroke="var(--color-accent)" stroke-width="2" pathLength="1" />
			{#each [150, 450, 750, 1050] as x}<circle cx={x} cy="20" r="6" fill="var(--color-accent)" pathLength="1" />{/each}
		</svg>
	</div>
	<ol use:stagger={90} class="scroll-in grid grid-cols-1 gap-4 md:grid-cols-4">
		{#each THIRTY_DAYS.steps as s, i}
			{@const clip = tiles[`week:${i + 1}`]}
			<li class="card relative overflow-hidden rounded-2xl border border-line bg-surface-2 p-6">
				{#if clip}{#key clip}<video class="lazy dim absolute inset-0 h-full w-full object-cover" muted loop playsinline preload="none" use:lazyVideo={{ src: clip }} aria-hidden="true"></video>{/key}{/if}
				<div aria-hidden="true" class="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(22,26,38,0.5),var(--color-surface-2)_65%)]"></div>
				<div class="relative flex items-center justify-between">
					<span class="label-mono text-accent">{s.week}</span>
					<span class="font-mono text-[28px] font-bold leading-none text-ink-3">0{i + 1}</span>
				</div>
				<h3 class="relative mt-5 text-[20px] font-semibold tracking-tight text-ink">{s.name}</h3>
				<p class="relative mt-3 text-[14px] leading-relaxed text-ink-2">{s.body}</p>
				{#if i === 0}<Motif kind="calendar" class="relative mt-4 h-16 w-16 text-accent opacity-70" />{:else if i === 1}<Motif kind="board" class="relative mt-4 h-16 w-16 text-accent opacity-70" />{:else if i === 2}<Motif kind="checklist" class="relative mt-4 h-16 w-16 text-accent opacity-70" />{:else}<Motif kind="chart" class="relative mt-4 h-16 w-16 text-accent opacity-70" />{/if}
				{#if i < THIRTY_DAYS.steps.length - 1}
					<span aria-hidden="true" class="absolute -right-2.5 top-8 hidden h-px w-5 bg-line-strong md:block"></span>
				{/if}
			</li>
		{/each}
	</ol>
</Section>

<style>
	.card { --dim: 0.2; }
</style>
