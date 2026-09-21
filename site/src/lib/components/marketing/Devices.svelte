<script lang="ts">
	import { getContext } from 'svelte';
	import Section from '$lib/components/ui/Section.svelte';
	import LiveBoard from './LiveBoard.svelte';
	import { lazyVideo, stagger, tilt } from '$lib/components/motion/actions';
	import { DEVICES, PLATFORM } from '$lib/content/site';
	import { LANDING_DEFAULTS, listOr, type Landing } from '$lib/content/remote';
	/**
	 * The board on a MacBook, an iPhone and a Windows laptop — drawn in CSS,
	 * the screens alive (the live board, a phone view of the day, footage of
	 * the work) — over six figures on what it does for the money.
	 */
	const landing = getContext<Landing | undefined>('landing');
	const tiles = $derived(landing?.tiles ?? LANDING_DEFAULTS.tiles);
	const gains = $derived(listOr(landing?.lists?.gains, DEVICES.gains, (r) => ({ figure: r.a, name: r.b, body: r.c })));
	const day = PLATFORM.tabs[0].widgets;
</script>

<Section id="devices" eyebrow={DEVICES.eyebrow} title={DEVICES.title} lede={DEVICES.lede} tone="surface" wide>
	<div class="scroll-in relative mx-auto grid max-w-6xl grid-cols-1 items-end gap-6 md:grid-cols-[1fr_minmax(0,1.6fr)_1fr] md:gap-4">
		<!-- iPhone -->
		<div use:tilt={6} class="device phone mx-auto w-[210px] md:mx-0 md:justify-self-end">
			<div class="relative aspect-[9/19.5] w-full overflow-hidden rounded-[38px] border-[6px] border-[#1a1d27] bg-surface-3 shadow-2">
				<div class="absolute left-1/2 top-2 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-[#1a1d27]"></div>
				<div class="flex h-full flex-col overflow-hidden px-4 pb-4 pt-10 text-[10px]">
					<p class="label-mono text-ink-3">app.hostos · Today</p>
					<p class="mt-2 text-[15px] font-semibold text-ink">Good morning, John</p>
					<div class="mt-3 grid grid-cols-2 gap-2">
						{#each day.filter((w) => w.kind === 'kpi') as w}
							<div class="rounded-xl border border-line bg-surface-2 p-2.5"><p class="label-mono text-ink-3">{w.label}</p><p class="mt-1 text-[18px] font-semibold text-ink">{w.value}</p><p class="text-ink-3">{w.note}</p></div>
						{/each}
					</div>
					<div class="mt-3 rounded-xl border border-line bg-surface-2 p-2.5">
						<p class="label-mono mb-1.5 text-ink-3">Next up</p>
						{#each (day.find((w) => w.kind === 'list')?.rows ?? []).slice(0, 2) as [t, txt]}<p class="flex gap-2 truncate py-1 text-ink-2"><span class="shrink-0 font-mono text-accent">{t}</span><span class="truncate">{txt}</span></p>{/each}
					</div>
					<div class="mt-3 flex items-center gap-2 truncate rounded-xl border border-ok/50 bg-ok/10 p-2.5 text-ink"><span class="h-1.5 w-1.5 shrink-0 rounded-full bg-ok"></span><span class="truncate">Civic back · 12 photos · no damage</span></div>
				</div>
			</div>
		</div>
		<!-- MacBook -->
		<div use:tilt={4} class="device mac w-full">
			<div class="relative aspect-[16/10] w-full overflow-hidden rounded-t-2xl border-[8px] border-b-0 border-[#1a1d27] bg-surface-3 shadow-2">
				<div class="absolute inset-0 p-3 sm:p-4"><LiveBoard /></div>
			</div>
			<div class="mx-auto h-3 w-[104%] -translate-x-[2%] rounded-b-xl bg-[linear-gradient(180deg,#2a2e3b,#12141c)]"></div>
		</div>
		<!-- Windows laptop -->
		<div use:tilt={6} class="device win mx-auto w-[260px] md:mx-0 md:justify-self-start">
			<div class="relative aspect-[16/10] w-full overflow-hidden rounded-t-xl border-[6px] border-b-0 border-[#1a1d27] bg-surface-3 shadow-2">
				{#if tiles['pillar:software']}<video class="lazy dim absolute inset-0 h-full w-full object-cover" style="--dim:0.55" muted loop playsinline preload="none" use:lazyVideo={{ src: tiles['pillar:software'], always: true }} aria-hidden="true"></video>{/if}
				<div class="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,var(--color-surface-3))] p-3 text-[10px]"><p class="label-mono text-ink-3">Butler · this morning</p><p class="mt-1 text-[12px] font-semibold text-ink">7 tasks raised · 5 follow-ups sent</p></div>
			</div>
			<div class="h-2.5 w-[106%] -translate-x-[3%] rounded-b-lg bg-[linear-gradient(180deg,#2a2e3b,#12141c)]"></div>
		</div>
	</div>

	<div use:stagger={70} class="scroll-in mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 md:mt-20">
		{#each gains as g, i}
			<article class="spot ring-hover rounded-2xl border border-line bg-surface-2 p-6 transition-[border-color] duration-300 hover:border-accent/50">
				<p class="font-mono text-[34px] font-bold leading-none tracking-tight text-accent">{g.figure}</p>
				<h3 class="mt-3 text-[18px] font-semibold tracking-tight text-ink">{g.name}</h3>
				<p class="mt-2 text-[14.5px] leading-relaxed text-ink-2">{g.body}</p>
			</article>
		{/each}
	</div>
</Section>

<style>
	.device { animation: hover 7s ease-in-out infinite; }
	.phone { animation-delay: -2s; }
	.win { animation-delay: -4s; }
	@keyframes hover { 0%, 100% { translate: 0 0; } 50% { translate: 0 -10px; } }
	@media (prefers-reduced-motion: reduce) { .device { animation: none; } }
</style>
