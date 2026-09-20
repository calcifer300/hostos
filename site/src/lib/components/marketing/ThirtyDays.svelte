<script lang="ts">
	import Section from '$lib/components/ui/Section.svelte';
	import { stagger } from '$lib/components/motion/actions';
	import { THIRTY_DAYS } from '$lib/content/site';
</script>

<Section id="start" eyebrow={THIRTY_DAYS.eyebrow} title={THIRTY_DAYS.title} tone="surface">
	<ol use:stagger={90} class="grid grid-cols-1 gap-4 md:grid-cols-4">
		{#each THIRTY_DAYS.steps as s, i}
			<li class="relative rounded-2xl border border-line bg-surface-2 p-6">
				<div class="flex items-center justify-between">
					<span class="label-mono text-accent">{s.week}</span>
					<span class="font-mono text-[28px] font-bold leading-none text-ink-3">0{i + 1}</span>
				</div>
				<h3 class="mt-5 text-[20px] font-semibold tracking-tight text-ink">{s.name}</h3>
				<p class="mt-3 text-[14px] leading-relaxed text-ink-2">{s.body}</p>
				{#if i < THIRTY_DAYS.steps.length - 1}
					<span aria-hidden="true" class="absolute -right-2.5 top-8 hidden h-px w-5 bg-line-strong md:block"></span>
				{/if}
			</li>
		{/each}
	</ol>
</Section>
