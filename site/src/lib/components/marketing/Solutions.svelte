<script lang="ts">
	import { ArrowRight } from 'lucide-svelte';
	import Section from '$lib/components/ui/Section.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { lazyVideo, tilt } from '$lib/components/motion/actions';
	import { FILM, VIDEO } from '$lib/content/site';
	import { getContext } from 'svelte';
	import { LANDING_DEFAULTS, type Landing } from '$lib/content/remote';
	const landing = getContext<Landing | undefined>('landing');
	const tiles = $derived(landing?.tiles ?? LANDING_DEFAULTS.tiles);
	let { chapters = FILM.chapters, extras = { team: VIDEO.team, delivery: VIDEO.delivery, closing: VIDEO.closing } }: { chapters?: typeof FILM.chapters; extras?: { team: string; delivery: string; closing: string } } = $props();
	const banner = $derived([extras.team, tiles['solution:webapps'] || chapters[3].src, extras.delivery, extras.closing]);
	import Motif from '$lib/components/ui/Motif.svelte';
	const motifs = { run: 'schedule', build: 'blocks', connect: 'nodes', understand: 'chart' } as const;
	import { CTA, SOLUTIONS } from '$lib/content/site';
	let active = $state(0);
	const family = $derived(SOLUTIONS.families[active]);
</script>

<Section id="solutions" eyebrow={SOLUTIONS.eyebrow} title={SOLUTIONS.title} tone="surface">
	<div class="mb-8 flex flex-wrap gap-2" role="tablist" aria-label="Solution families">
		{#each SOLUTIONS.families as f, i}
			<button type="button" role="tab" id={`fam-${f.id}`} aria-selected={active === i} aria-controls={`panel-${f.id}`} onclick={() => (active = i)} class={`rounded-full border px-4 py-2 text-[13.5px] font-medium transition-colors ${active === i ? 'border-accent bg-accent/10 text-ink' : 'border-line text-ink-2 hover:border-line-strong hover:text-ink'}`}>
				<span class="label-mono mr-2 text-accent">0{i + 1}</span>{f.name}
			</button>
		{/each}
	</div>
	<!-- the four families at once: a collage of landscape clips, each a little off the line; the chosen one steps forward -->
	<div class="collage mb-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4" aria-hidden="true">
		{#each SOLUTIONS.families as f, i (f.id)}
			<button type="button" tabindex="-1" aria-label={`Show ${f.name}`} onclick={() => (active = i)} class={`tile relative aspect-video overflow-hidden rounded-2xl border bg-surface-2 text-left transition-[transform,box-shadow,border-color,opacity] duration-700 ease-[var(--ease-out-expo)] ${i === active ? 'z-10 scale-[1.04] border-accent/60 shadow-2 opacity-100' : 'border-line opacity-80 hover:opacity-100'}`} style={`--i:${i}`}>
				{#key banner[i]}<video class="lazy dim absolute inset-0 h-full w-full object-cover" style={`--dim:${i === active ? 0.9 : 0.55}`} muted loop playsinline preload="none" use:lazyVideo={{ src: banner[i], always: true }}></video>{/key}
				<div class="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,color-mix(in_oklab,var(--color-surface-2)_85%,transparent)_100%)]"></div>
				<p class="absolute bottom-3 left-4 flex items-center gap-2 text-[13px] font-semibold text-ink"><span class="label-mono text-accent">0{i + 1}</span>{f.name}</p>
			</button>
		{/each}
	</div>
	<div class="mb-6 flex items-center justify-between gap-6">
		<p class="text-[16px] text-ink-2">{family.line}</p>
		{#key active}<Motif kind={motifs[family.id as keyof typeof motifs]} class="arrive h-16 w-16 shrink-0 text-accent" />{/key}
	</div>
	{#key active}
		<div id={`panel-${family.id}`} role="tabpanel" aria-labelledby={`fam-${family.id}`} class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each family.items as s, i}
				{@const clip = tiles[`solution:${s.id}`]}
				<article use:tilt={4} class="card spot ring-hover reveal is-in relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface-2 p-5 transition-[border-color] duration-300 hover:border-accent/50" style={`--reveal-delay:${i * 60}ms`}>
					{#if clip}{#key clip}<video class="lazy dim absolute inset-0 h-full w-full object-cover" muted loop playsinline preload="none" use:lazyVideo={{ src: clip }} aria-hidden="true"></video>{/key}{/if}
					<div aria-hidden="true" class="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--color-surface-2)_35%,transparent),var(--color-surface-2)_70%)]"></div>
					<div class="relative flex flex-1 flex-col">
						<Motif kind={motifs[family.id as keyof typeof motifs]} class="mb-3 h-9 w-9 text-accent opacity-70" />
						<h3 class="text-[17px] font-semibold tracking-tight text-ink">{s.name}</h3>
						<p class="mt-1.5 text-[14px] font-medium text-accent">{s.outcome}</p>
						<ul class="mt-4 space-y-1.5">
							{#each s.points as pt}<li class="flex items-start gap-2 text-[13.5px] text-ink-2"><span class="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent"></span>{pt}</li>{/each}
						</ul>
						<p class="label-mono mt-auto pt-5 text-ink-3">For {s.for}</p>
					</div>
				</article>
			{/each}
		</div>
	{/key}
	<div class="mt-10"><Button href={CTA.href} variant="secondary">Ask which of these you need <ArrowRight class="h-4 w-4" /></Button></div>
</Section>

<style>
	.card { --dim: 0.38; }
	/* the collage sits a little off the line, like prints on a desk */
	@media (min-width: 768px) {
		.collage .tile:nth-child(1) { transform: translateY(14px) rotate(-1.2deg); }
		.collage .tile:nth-child(2) { transform: translateY(-8px) rotate(0.8deg); }
		.collage .tile:nth-child(3) { transform: translateY(10px) rotate(-0.6deg); }
		.collage .tile:nth-child(4) { transform: translateY(-12px) rotate(1.1deg); }
		.collage .tile.z-10 { transform: translateY(0) rotate(0) scale(1.06); }
	}
	.tile :global(video) { mix-blend-mode: normal; filter: none; }
	.card:hover :global(video.is-playing) { opacity: 0.42; }
</style>
