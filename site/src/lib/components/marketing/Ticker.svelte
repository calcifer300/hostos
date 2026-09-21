<script lang="ts">
	import { INDUSTRIES } from '$lib/content/site';
	/** The verticals sliding past between sections: small, in the muted ink, each with its dot of colour. */
	const items = INDUSTRIES.items.map((i) => ({ name: i.name, hue: i.hue }));
</script>

<div aria-hidden="true" class="ticker relative overflow-hidden border-y border-line bg-surface-1 py-5 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
	<div class="ticker-track flex w-max items-center gap-10 whitespace-nowrap text-[15px] font-semibold tracking-tight text-ink-3 md:text-[17px]">
		{#each [...items, ...items] as it}
			<span class="flex items-center gap-10"><span class="flex items-center gap-2.5"><span class="h-1.5 w-1.5 rounded-full" style={`background:${it.hue}`}></span>{it.name}</span></span>
		{/each}
	</div>
</div>
