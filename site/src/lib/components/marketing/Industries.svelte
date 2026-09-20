<script lang="ts">
	import Section from '$lib/components/ui/Section.svelte';
	import { stagger, tilt } from '$lib/components/motion/actions';
	import { INDUSTRIES } from '$lib/content/site';
</script>

<Section id="industries" eyebrow={INDUSTRIES.eyebrow} title={INDUSTRIES.title}>
	<div use:stagger={50} class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
		{#each INDUSTRIES.items as ind}
			<a href={ind.href} use:tilt={5} class="industry spot group block rounded-2xl border border-line bg-surface-2 p-5 transition-[border-color,box-shadow] duration-300 hover:shadow-1" style={`--spot:${ind.hue}; --hue:${ind.hue}`}>
				<span class="block h-1.5 w-8 rounded-full" style={`background:${ind.hue}`}></span>
				<h3 class="mt-5 text-[16px] font-semibold tracking-tight text-ink">{ind.name}</h3>
				<p class="mt-1 text-[13px] text-ink-3">{ind.line}</p>
			</a>
		{/each}
	</div>
</Section>

<style>
	.industry:hover {
		border-color: color-mix(in oklab, var(--hue) 55%, var(--color-line));
	}
</style>
