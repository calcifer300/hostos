<script lang="ts">
	import { INDUSTRIES } from '$lib/content/site';
	/** The verticals between sections: small, in the muted ink, each with its dot of colour. A row that holds still. */
	const items = INDUSTRIES.items.map((i) => ({ name: i.name, hue: i.hue }));
</script>

<div aria-hidden="true" class="ticker relative border-y border-line bg-surface-1 py-5">
	<div class="container-x flex flex-wrap items-center justify-center gap-x-8 gap-y-2.5 text-[14px] font-semibold tracking-tight text-ink-3 md:gap-x-10 md:text-[15px]">
		{#each items as it}
			<span class="flex items-center gap-2.5"><span class="h-1.5 w-1.5 rounded-full" style={`background:${it.hue}`}></span>{it.name}</span>
		{/each}
	</div>
</div>
