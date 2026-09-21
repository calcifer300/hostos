<script lang="ts">
	import { Users, ListChecks, LayoutDashboard } from 'lucide-svelte';
	import Section from '$lib/components/ui/Section.svelte';
	import { getContext } from 'svelte';
	import { lazyVideo, reveal, stagger } from '$lib/components/motion/actions';
	import { HOW } from '$lib/content/site';
	import { LANDING_DEFAULTS, type Landing } from '$lib/content/remote';
	const landing = getContext<Landing | undefined>('landing');
	const tiles = $derived(landing?.tiles ?? LANDING_DEFAULTS.tiles);
	import Motif from '$lib/components/ui/Motif.svelte';
	const icons = { people: Users, systems: ListChecks, software: LayoutDashboard } as const;
	const scenes = { people: 'people', systems: 'checklist', software: 'board' } as const;
</script>

<Section id="how" eyebrow={HOW.eyebrow} title={HOW.title} tone="surface" voice="grotesk">
	<!-- the connector: people → systems → software, drawn on arrival -->
	<div use:reveal class="draw relative mb-8 hidden h-14 md:block" aria-hidden="true">
		<svg viewBox="0 0 1200 56" class="h-full w-full" fill="none" preserveAspectRatio="none">
			<path d="M200 28 H1000" stroke="var(--color-line-strong)" stroke-width="1.5" pathLength="1" />
			<path d="M200 28 H1000" stroke="var(--color-accent)" stroke-width="1.5" pathLength="1" />
			<circle cx="200" cy="28" r="5" fill="var(--color-accent)" pathLength="1" />
			<circle cx="600" cy="28" r="5" fill="var(--color-accent)" pathLength="1" />
			<circle cx="1000" cy="28" r="5" fill="var(--color-platform)" pathLength="1" />
		</svg>
	</div>
	<div use:stagger={90} class="scroll-in grid grid-cols-1 gap-4 md:grid-cols-3">
		{#each HOW.pillars as p, i}
			{@const Icon = icons[p.id as keyof typeof icons]}
			{@const clip = tiles[`pillar:${p.id}`]}
			<article class="card relative overflow-hidden rounded-2xl border border-line bg-surface-2 p-6">
				{#if clip}{#key clip}<video class="lazy dim absolute inset-0 h-full w-full object-cover" muted loop playsinline preload="none" use:lazyVideo={{ src: clip }} aria-hidden="true"></video>{/key}{/if}
				<div aria-hidden="true" class="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(22,26,38,0.5),var(--color-surface-2)_60%)]"></div>
				<div class="relative flex items-center justify-between">
					<span class={`flex h-11 w-11 items-center justify-center rounded-xl ${i === 2 ? 'bg-platform/15 text-platform' : 'bg-accent/15 text-accent'}`}><Icon class="h-5 w-5" /></span>
					<span class="label-mono text-ink-3">0{i + 1}</span>
				</div>
				<h3 class="relative mt-5 text-[22px] font-semibold tracking-tight text-ink">{p.name}</h3>
				<p class={`relative mt-1 text-[14px] font-medium ${i === 2 ? 'text-platform' : 'text-accent'}`}>{p.line}</p>
				<p class="relative mt-4 text-[14.5px] leading-relaxed text-ink-2">{p.body}</p>
				<Motif kind={scenes[p.id as keyof typeof scenes]} class={`relative mt-5 h-24 w-full ${i === 2 ? 'text-platform' : 'text-accent'} opacity-80`} />
			</article>
		{/each}
	</div>
</Section>

<style>
	.card { --dim: 0.2; }
</style>
