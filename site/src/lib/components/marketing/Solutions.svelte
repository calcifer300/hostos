<script lang="ts">
	import { ArrowRight } from 'lucide-svelte';
	import Section from '$lib/components/ui/Section.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { lazyVideo, tilt } from '$lib/components/motion/actions';
	import { FILM, VIDEO } from '$lib/content/site';
	let { chapters = FILM.chapters, extras = { team: VIDEO.team, delivery: VIDEO.delivery, closing: VIDEO.closing } }: { chapters?: typeof FILM.chapters; extras?: { team: string; delivery: string; closing: string } } = $props();
	const banner = $derived([extras.team, chapters[3].src, extras.delivery, extras.closing]);
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
	<div class="relative mb-6 h-40 overflow-hidden rounded-2xl border border-line bg-bg sm:h-52" aria-hidden="true">
		{#each SOLUTIONS.families as f, i (f.id)}
			<div class={`absolute inset-0 transition-opacity duration-1000 ${i === active ? 'opacity-100' : 'opacity-0'}`}>
				{#if Math.abs(i - active) <= 1}{#key banner[i]}<video class="lazy h-full w-full object-cover" muted loop playsinline preload="none" use:lazyVideo={{ src: banner[i], always: true }}></video>{/key}{/if}
			</div>
		{/each}
		<div class="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,var(--color-surface-1)_0%,transparent_45%,transparent_70%,var(--color-surface-1)_100%)]"></div>
		<div class="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_50%,var(--color-surface-1)_100%)]"></div>
		<p class="label-mono absolute bottom-4 left-5 text-accent">0{active + 1} · {family.name}</p>
	</div>
	<div class="mb-6 flex items-center justify-between gap-6">
		<p class="text-[16px] text-ink-2">{family.line}</p>
		{#key active}<Motif kind={motifs[family.id as keyof typeof motifs]} class="arrive h-16 w-16 shrink-0 text-accent" />{/key}
	</div>
	{#key active}
		<div id={`panel-${family.id}`} role="tabpanel" aria-labelledby={`fam-${family.id}`} class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each family.items as s, i}
				<article use:tilt={4} class="spot ring-hover reveal is-in flex flex-col rounded-2xl border border-line bg-surface-2 p-5 transition-[border-color] duration-300 hover:border-accent/50" style={`--reveal-delay:${i * 60}ms`}>
					<Motif kind={motifs[family.id as keyof typeof motifs]} class="mb-3 h-9 w-9 text-accent opacity-70" />
					<h3 class="text-[17px] font-semibold tracking-tight text-ink">{s.name}</h3>
					<p class="mt-1.5 text-[14px] font-medium text-accent">{s.outcome}</p>
					<ul class="mt-4 space-y-1.5">
						{#each s.points as pt}<li class="flex items-start gap-2 text-[13.5px] text-ink-2"><span class="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent"></span>{pt}</li>{/each}
					</ul>
					<p class="label-mono mt-auto pt-5 text-ink-3">For {s.for}</p>
				</article>
			{/each}
		</div>
	{/key}
	<div class="mt-10"><Button href={CTA.href} variant="secondary">Ask which of these you need <ArrowRight class="h-4 w-4" /></Button></div>
</Section>
