<script lang="ts">
	import Section from '$lib/components/ui/Section.svelte';
	import { stagger, tilt } from '$lib/components/motion/actions';
	import { PROBLEMS } from '$lib/content/site';
	/** Six Tuesdays. The visitor finds theirs; the answer is under the card. */
</script>

<Section id="problems" eyebrow={PROBLEMS.eyebrow} title={PROBLEMS.title}>
	<div use:stagger={70} class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each PROBLEMS.items as p, i}
			<article use:tilt={5} class="spot group flex min-h-[220px] flex-col justify-between rounded-2xl border border-line bg-surface-2 p-6 transition-[border-color,box-shadow] duration-300 hover:border-accent/50 hover:shadow-1">
				<p class="label-mono text-ink-3">{String(i + 1).padStart(2, '0')}</p>
				<p class="mt-6 text-[18px] font-medium leading-snug text-ink">{p.scene}</p>
				<p class="mt-5 border-t border-line pt-4 text-[13.5px] leading-relaxed text-ink-2"><span class="label-mono mr-2 text-accent">What we do</span>{p.answer}</p>
			</article>
		{/each}
	</div>
</Section>
