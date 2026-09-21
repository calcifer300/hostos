<script lang="ts">
	import { INDUSTRIES } from '$lib/content/site';
	/** A band of the verticals sliding past, each in its own colour and glow; the scroll nudges it along. */
	const items = INDUSTRIES.items.map((i) => ({ name: i.name, hue: i.hue }));
</script>

<div aria-hidden="true" class="ticker relative overflow-hidden border-y border-line bg-surface-1 py-6 md:py-8 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
	<div class="ticker-track voice-display flex w-max items-center gap-6 whitespace-nowrap text-[26px] font-bold leading-none tracking-tight md:text-[40px]">
		{#each [...items, ...items] as it}
			<span class="ticker-item flex items-center gap-6" style={`--hue:${it.hue}`}>{it.name}<span class="h-2 w-2 rounded-full md:h-2.5 md:w-2.5" style={`background:${it.hue}; box-shadow: 0 0 14px ${it.hue}`}></span></span>
		{/each}
	</div>
</div>

<style>
	.ticker-item {
		background: linear-gradient(90deg, var(--hue), color-mix(in oklab, var(--hue) 35%, white));
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		filter: drop-shadow(0 0 16px color-mix(in oklab, var(--hue) 55%, transparent));
	}
</style>
