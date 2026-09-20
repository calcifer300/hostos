<script lang="ts">
	import { ArrowRight } from 'lucide-svelte';
	import Section from '$lib/components/ui/Section.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { tilt } from '$lib/components/motion/actions';
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
	<p class="mb-6 text-[16px] text-ink-2">{family.line}</p>
	{#key active}
		<div id={`panel-${family.id}`} role="tabpanel" aria-labelledby={`fam-${family.id}`} class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each family.items as s, i}
				<article use:tilt={4} class="spot reveal is-in flex flex-col rounded-2xl border border-line bg-surface-2 p-5 transition-[border-color] duration-300 hover:border-accent/50" style={`--reveal-delay:${i * 60}ms`}>
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
