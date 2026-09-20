<script lang="ts">
	import Section from '$lib/components/ui/Section.svelte';
	import { countUp, stagger, tilt } from '$lib/components/motion/actions';
	import { PROOF } from '$lib/content/site';
	/** Numbers first, dated, named where allowed. A quote without a number is wallpaper; none here. */
</script>

<Section id="proof" eyebrow={PROOF.eyebrow} title={PROOF.title} tone="surface">
	<div use:stagger={90} class="grid grid-cols-1 gap-4 md:grid-cols-3">
		{#each PROOF.cases as c}
			<article use:tilt={4} class="ring-hover relative overflow-hidden rounded-2xl border border-line bg-surface-2 p-6" style={`--spot:${c.hue}`}>
				<div aria-hidden="true" class="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-25 blur-3xl" style={`background:${c.hue}`}></div>
				<p class="font-mono text-[56px] font-bold leading-none tracking-tight text-ink" style={`color:color-mix(in oklab, ${c.hue} 70%, white)`}><span use:countUp={c.figure}>{c.figure}{c.suffix}</span></p>
				<p class="label-mono mt-2 text-ink-3">{c.label}</p>
				<p class="mt-5 text-[14.5px] leading-relaxed text-ink-2">{c.line}</p>
				<p class="mt-5 border-t border-line pt-4 text-[12.5px] text-ink-3">{c.who} · {c.when}</p>
			</article>
		{/each}
	</div>
</Section>
