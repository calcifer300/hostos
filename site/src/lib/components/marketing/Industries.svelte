<script lang="ts">
	import { getContext } from 'svelte';
	import { BedDouble, Bike, Building2, Car, Rocket, Store, Truck, Wrench } from 'lucide-svelte';
	import Section from '$lib/components/ui/Section.svelte';
	import { lazyVideo, stagger, tilt } from '$lib/components/motion/actions';
	import { INDUSTRIES } from '$lib/content/site';
	import { LANDING_DEFAULTS, type Landing } from '$lib/content/remote';
	/**
	 * Eight tiles, each with its vertical's footage moving under the words
	 * (dimmed, colourless, loaded only as it nears the screen) and its mark
	 * in its own colour. The Founder swaps or clears any clip in Settings.
	 */
	const landing = getContext<Landing | undefined>('landing');
	const tiles = $derived(landing?.tiles ?? LANDING_DEFAULTS.tiles);
	const icons = { turo: Car, doordash: Bike, hospitality: BedDouble, fleet: Truck, property: Building2, services: Wrench, small: Store, startups: Rocket } as const;
	const always = new Set(['turo', 'doordash']); // these two play on phones as well
</script>

<Section id="industries" eyebrow={INDUSTRIES.eyebrow} title={INDUSTRIES.title} voice="display" align="center">
	<div use:stagger={50} class="scroll-in grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
		{#each INDUSTRIES.items as ind}
			{@const Icon = icons[ind.id as keyof typeof icons]}
			{@const clip = tiles[`industry:${ind.id}`]}
			<a href={ind.href} use:tilt={5} class="industry spot ring-hover group relative block overflow-hidden rounded-2xl border border-line bg-surface-2 p-5 transition-[border-color,box-shadow] duration-300 hover:shadow-1" style={`--spot:${ind.hue}; --hue:${ind.hue}`}>
				{#if clip}{#key clip}<video class="lazy dim absolute inset-0 h-full w-full object-cover" muted loop playsinline preload="none" use:lazyVideo={{ src: clip, always: always.has(ind.id) }} aria-hidden="true"></video>{/key}{/if}
				<div aria-hidden="true" class="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(22,26,38,0.25),var(--color-surface-2)_88%)]"></div>
				<div class="relative">
					<div class="flex items-start justify-between">
						<span class="block h-1.5 w-8 rounded-full transition-[width] duration-500 group-hover:w-14" style={`background:${ind.hue}`}></span>
						{#if Icon}<span class="mark grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm transition-transform duration-500 group-hover:-translate-y-0.5" style={`color:${ind.hue}`}><Icon class="h-[18px] w-[18px]" strokeWidth={1.75} /></span>{/if}
					</div>
					<h3 class="mt-5 text-[16px] font-semibold tracking-tight text-ink">{ind.name}</h3>
					<p class="mt-1 text-[13px] text-ink-3">{ind.line}</p>
				</div>
			</a>
		{/each}
	</div>
</Section>

<style>
	.industry:hover {
		border-color: color-mix(in oklab, var(--hue) 55%, var(--color-line));
	}
	.industry {
		--dim: 0.32;
	}
	.industry:hover :global(video.is-playing) {
		opacity: 0.5;
	}
	.industry :global(video) {
		transition: opacity 1.2s var(--ease-standard);
	}
</style>
