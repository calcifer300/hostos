<script lang="ts">
	import { ArrowUpRight, Crown } from 'lucide-svelte';
	import Section from '$lib/components/ui/Section.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { lazyVideo, stagger } from '$lib/components/motion/actions';
	import { SITE, VIDEO } from '$lib/content/site';
	import type { Member } from '$lib/content/team';
	/** The people, as faces. The full roster and the spotlight live on /team in the app. */
	import Constellation from './Constellation.svelte';
	let { members, teamSrc = VIDEO.team }: { members: Member[]; teamSrc?: string } = $props();
</script>

<Section id="collective" eyebrow="The Collective" title="A collective, not a hierarchy chart." lede="Twelve people who each own a craft, work inside the same HostOS workspace, and answer to the same clients. What we sell is what we use.">
	<div class="relative isolate">
	<div aria-hidden="true" class="pointer-events-none absolute -inset-x-8 -inset-y-12 -z-20 overflow-hidden rounded-[40px] [mask-image:radial-gradient(ellipse_at_center,#000_30%,transparent_80%)]">
		<video class="lazy dim h-full w-full object-cover" style="--dim:0.34" muted loop playsinline preload="none" use:lazyVideo={{ src: teamSrc }}></video>
	</div>
	<Constellation hues={members.map((m) => m.hue)} class="pointer-events-none absolute -inset-x-8 -inset-y-12 -z-10 h-[calc(100%+6rem)] w-[calc(100%+4rem)] [mask-image:radial-gradient(ellipse_at_center,#000_55%,transparent_95%)]" />
	<ul use:stagger={45} class="collage grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Members">
		{#each members as m, i}
			<li class="tile group relative overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-1" style={`--hue:${m.hue}; --i:${i}`}>
				<div class="relative aspect-[4/5] overflow-hidden">
					<img src={m.photo} alt={m.name} width="360" height="450" loading="lazy" decoding="async" class="h-full w-full scale-[1.14] object-cover object-[50%_22%] transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.2]" />
					<div aria-hidden="true" class="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(to_top,var(--color-surface-2),transparent)]"></div>
					{#if m.founder}<span class="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur"><Crown class="h-3 w-3" /> Founder</span>{/if}
				</div>
				<div class="px-3 pb-4 pt-1 text-center">
					<p class="name text-[14px] font-bold leading-tight tracking-tight">{m.name}</p>
					<p class="role mt-1 text-[15px] leading-snug" style={`--hue:${m.hue}`}>{m.title}</p>
				</div>
			</li>
		{/each}
	</ul>
	</div>
	<div class="mt-10 text-center"><Button href={`${SITE.url}/team`} variant="secondary">Meet everyone <ArrowUpRight class="h-4 w-4" /></Button></div>
</Section>

<style>
	/* a collage: every other tile a step down, each drifting on its own slow clock */
	@media (min-width: 640px) {
		.collage .tile { animation: drift 9s ease-in-out infinite; animation-delay: calc(var(--i) * -1.3s); }
		.collage .tile:nth-child(even) { margin-top: 28px; }
		.collage .tile:nth-child(3n) { rotate: -1.2deg; }
		.collage .tile:nth-child(3n + 1) { rotate: 0.9deg; }
	}
	.collage .tile:hover { rotate: 0deg; z-index: 2; box-shadow: 0 24px 50px -20px rgb(23 27 39 / 0.35); }
	@keyframes drift { 0%, 100% { translate: 0 0; } 50% { translate: 0 -8px; } }
	/* the name in the ink gradient, the role in the serif aside — the house type */
	.name { background: linear-gradient(180deg, var(--color-ink), color-mix(in oklab, var(--color-ink) 70%, var(--hue))); -webkit-background-clip: text; background-clip: text; color: transparent; }
	.role { font-family: var(--font-serif); font-style: italic; background: linear-gradient(90deg, color-mix(in oklab, var(--hue) 70%, #2c3ef3), color-mix(in oklab, var(--hue) 45%, #171b27)); -webkit-background-clip: text; background-clip: text; color: transparent; }
	@media (prefers-reduced-motion: reduce) { .collage .tile { animation: none; } }
</style>
