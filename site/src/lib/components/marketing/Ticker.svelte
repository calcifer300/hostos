<script lang="ts">
	import { INDUSTRIES } from '$lib/content/site';
	/** A band of the verticals in the loud voice, pulled sideways by the scroll (a marquee where the browser can't). */
	const items = INDUSTRIES.items.map((i) => i.name);
</script>

<div aria-hidden="true" class="ticker relative overflow-hidden border-y border-line bg-surface-1 py-8 md:py-12">
	<div class="ticker-track voice-display flex w-max items-center gap-8 whitespace-nowrap text-[44px] font-bold leading-none tracking-tight text-ink-3/70 md:text-[76px]">
		{#each [...items, ...items] as name}
			<span class="flex items-center gap-8">{name}<span class="h-3 w-3 rounded-full bg-accent md:h-4 md:w-4"></span></span>
		{/each}
	</div>
</div>
