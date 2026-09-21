<script lang="ts">
	import Section from '$lib/components/ui/Section.svelte';
	import { reveal, stagger } from '$lib/components/motion/actions';
	import Motif from '$lib/components/ui/Motif.svelte';
	import { THIRTY_DAYS } from '$lib/content/site';
</script>

<Section id="start" eyebrow={THIRTY_DAYS.eyebrow} title={THIRTY_DAYS.title} tone="surface" voice="grotesk">
	<div use:reveal class="draw relative mb-6 hidden h-10 md:block" aria-hidden="true">
		<svg viewBox="0 0 1200 40" class="h-full w-full" fill="none" preserveAspectRatio="none">
			<path d="M150 20 H1050" stroke="var(--color-line-strong)" stroke-width="1.5" pathLength="1" />
			<path d="M150 20 H1050" stroke="var(--color-accent)" stroke-width="2" pathLength="1" />
			{#each [150, 450, 750, 1050] as x}<circle cx={x} cy="20" r="6" fill="var(--color-accent)" pathLength="1" />{/each}
		</svg>
	</div>
	<ol use:stagger={90} class="grid grid-cols-1 gap-4 md:grid-cols-4">
		{#each THIRTY_DAYS.steps as s, i}
			<li class="relative rounded-2xl border border-line bg-surface-2 p-6">
				<div class="flex items-center justify-between">
					<span class="label-mono text-accent">{s.week}</span>
					<span class="font-mono text-[28px] font-bold leading-none text-ink-3">0{i + 1}</span>
				</div>
				<h3 class="mt-5 text-[20px] font-semibold tracking-tight text-ink">{s.name}</h3>
				<p class="mt-3 text-[14px] leading-relaxed text-ink-2">{s.body}</p>
				{#if i === 0}<Motif kind="calendar" class="mt-4 h-16 w-16 text-accent opacity-70" />{:else if i === 1}<Motif kind="board" class="mt-4 h-16 w-16 text-accent opacity-70" />{:else if i === 2}<Motif kind="checklist" class="mt-4 h-16 w-16 text-accent opacity-70" />{:else}<Motif kind="chart" class="mt-4 h-16 w-16 text-accent opacity-70" />{/if}
				{#if i < THIRTY_DAYS.steps.length - 1}
					<span aria-hidden="true" class="absolute -right-2.5 top-8 hidden h-px w-5 bg-line-strong md:block"></span>
				{/if}
			</li>
		{/each}
	</ol>
</Section>
