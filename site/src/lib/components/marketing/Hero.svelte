<script lang="ts">
	import { ArrowDown, ArrowRight } from 'lucide-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import LiveBoard from './LiveBoard.svelte';
	import { lazyVideo, magnetic } from '$lib/components/motion/actions';
	import { CLIENT_FACES, CTA, HERO, LOGOS, VIDEO } from '$lib/content/site';
	import Logo from '$lib/components/ui/Logo.svelte';
	import { emph, plain } from '$lib/content/emph';
	import { getContext } from 'svelte';
	import { LANDING_DEFAULTS, type Landing } from '$lib/content/remote';
	const landing = getContext<Landing | undefined>('landing');
	const copy = $derived(landing?.copy ?? LANDING_DEFAULTS.copy);
	const lines = $derived([copy.hero.line1, copy.hero.line2]);
	const faces = CLIENT_FACES;
	import { onMount } from 'svelte';
	let { heroSrc = VIDEO.hero.src }: { heroSrc?: string } = $props();
	let video: HTMLVideoElement;
	let stage: HTMLElement;
	let top = $state(0);
	// the hero is pinned while the page slides over it; once covered, its footage stops
	onMount(() => {
		let covered = false;
		const next = () => document.getElementById('problems');
		const onScroll = () => {
			const c = (next()?.getBoundingClientRect().top ?? 1) <= 0;
			if (c === covered) return;
			covered = c;
			if (covered) video?.pause(); else if (video?.src) video.play().catch(() => {});
		};
		window.addEventListener('scroll', onScroll, { passive: true });
		// pin by the bottom edge when the hero is taller than the screen, so nothing of it is skipped
		const ro = new ResizeObserver(() => { top = Math.min(0, window.innerHeight - stage.offsetHeight); });
		ro.observe(stage);
		ro.observe(document.documentElement);
		return () => { window.removeEventListener('scroll', onScroll); ro.disconnect(); };
	});
</script>

<section id="hero" bind:this={stage} class="hero-stage relative overflow-hidden pt-36 pb-16 md:pt-44 md:pb-24" style={`--hero-top:${top}px`}>
	<!-- footage: a road at dusk, far behind the copy, only on wide screens and only when allowed -->
	<div aria-hidden="true" class="pointer-events-none absolute inset-0 -z-20">
		<video bind:this={video} class="lazy dim h-full w-full object-cover [mask-image:radial-gradient(ellipse_at_center,#000_30%,transparent_75%)]" style="--dim:0.2" muted loop playsinline preload="none" use:lazyVideo={{ src: heroSrc }}></video>
		<div class="absolute inset-0 bg-[linear-gradient(180deg,var(--color-bg)_0%,transparent_30%,transparent_60%,var(--color-bg)_100%)]"></div>
	</div>
	<div aria-hidden="true" class="pointer-events-none absolute inset-0 bg-[linear-gradient(var(--color-line)_1px,transparent_1px),linear-gradient(90deg,var(--color-line)_1px,transparent_1px)] bg-[size:72px_72px] opacity-30 [mask-image:radial-gradient(ellipse_at_top,#000_20%,transparent_70%)]"></div>
	<div aria-hidden="true" class="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-accent)_22%,transparent),transparent)] blur-3xl"></div>

	<div class="container-x text-center">
		<p class="arrive label-mono mb-6 text-accent">{copy.hero.eyebrow}</p>
		<!-- the mark, large: the brand greets before the words do -->
		<div class="arrive hero-mark mx-auto mb-7 flex justify-center" style="--reveal-delay:60ms">
			<span class="relative inline-flex items-center rounded-full border border-line bg-surface-2/70 py-3 pl-4 pr-6 shadow-1 backdrop-blur-sm">
				<span aria-hidden="true" class="halo-ring absolute inset-0 rounded-full"></span>
				<Logo size={56} wordSize={34} class="relative gap-3" />
			</span>
		</div>
		<h1 class="display-1 headline mx-auto max-w-5xl" aria-label={lines.map(plain).join(' ')}>
			{#each lines as line, i}
				<span class="plate is-in" aria-hidden="true"><span style={`--reveal-delay:${120 + i * 110}ms`}>{@html emph(line)}</span></span>
			{/each}
		</h1>
		<p class="arrive mx-auto mt-7 max-w-[64ch] text-[17px] leading-relaxed text-ink-2 md:text-[20px]" style="--reveal-delay:380ms">{copy.hero.body}</p>
		<div class="arrive mt-9 flex flex-wrap items-center justify-center gap-3" style="--reveal-delay:520ms">
			<span use:magnetic class="inline-block"><Button href={CTA.href} size="lg">{CTA.label} <ArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></Button></span>
			<Button href={HERO.secondary.href} variant="ghost" size="lg">{HERO.secondary.label} <ArrowDown class="h-4 w-4" /></Button>
		</div>
		<p class="arrive label-mono mt-5 text-ink-3" style="--reveal-delay:640ms">{CTA.under}</p>
		<!-- the trust line: the faces of owners who said so, five stars, the count -->
		<div class="arrive mx-auto mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 rounded-full border border-line bg-surface-2/80 px-5 py-3 backdrop-blur-sm" style="--reveal-delay:680ms" aria-label="Rated {copy.rating.value} {copy.rating.note}">
			{#if faces.length}<span class="flex -space-x-2.5">{#each faces as f, i}<img src={f} alt="" width="32" height="32" loading="lazy" class="face h-8 w-8 rounded-full border-2 border-surface-2 object-cover" style={`--d:${i * 60}ms`} />{/each}</span>{/if}
			<span class="flex items-center gap-1.5" aria-hidden="true">{#each [1, 2, 3, 4, 5] as s}<svg viewBox="0 0 20 20" class="star h-4 w-4" style={`--d:${s * 90}ms`} fill="#f5b301"><path d="M10 1.6l2.5 5.3 5.8.7-4.3 4 1.1 5.8L10 14.6l-5.1 2.8 1.1-5.8-4.3-4 5.8-.7z" /></svg>{/each}</span>
			<span class="text-[14px] text-ink-2"><span class="font-mono font-bold text-ink">{copy.rating.value}</span> {copy.rating.note}<span class="mx-2 text-ink-3">·</span>{copy.rating.count}</span>
		</div>
		<!-- what is in it for them, in four figures -->
		<ul class="arrive mx-auto mt-10 flex max-w-4xl flex-wrap items-stretch justify-center gap-2.5" style="--reveal-delay:720ms" aria-label="What you get">
			{#each HERO.outcomes as [figure, what]}
				<li class="flex items-center gap-2.5 rounded-full border border-line bg-surface-1/70 py-2 pl-3 pr-4 text-left text-[13.5px] text-ink-2 backdrop-blur-sm"><span class="font-mono text-[15px] font-bold text-ink">{figure}</span>{what}</li>
			{/each}
		</ul>
	</div>
	<div class="arrive container-x mt-14 md:mt-20" style="--reveal-delay:300ms">
		<div class="relative mx-auto max-w-3xl">
			<div aria-hidden="true" class="absolute -inset-6 -z-10 rounded-[40px] bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-platform)_18%,transparent),transparent_70%)]"></div>
			<div class="float motion-reduce:animate-none"><LiveBoard /></div>
		</div>
	</div>

	<div class="arrive container-x mt-16 md:mt-24" style="--reveal-delay:700ms">
		<p class="label-mono mb-4 text-center text-ink-3">Runs on the platforms your business already uses</p>
		<div class="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
			<ul class="flex w-max gap-10 animate-marquee motion-reduce:animate-none" aria-label="Platforms">
				{#each [...LOGOS, ...LOGOS] as l, i}
					<li aria-hidden={i >= LOGOS.length} class="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink-3">
						{#if l.icon}<img src={`https://cdn.simpleicons.org/${l.icon}/8e97ad`} alt="" width="20" height="20" loading="lazy" decoding="async" class="h-5 w-5 opacity-80" />{/if}{l.name}
					</li>
				{/each}
			</ul>
		</div>
	</div>
</section>

<style>
	.face { animation: face-in 0.5s var(--ease-out-expo) both; animation-delay: calc(0.7s + var(--d)); }
	@keyframes face-in { from { opacity: 0; transform: translateX(-8px) scale(0.6); } to { opacity: 1; transform: none; } }
	.halo-ring { box-shadow: 0 0 0 0 color-mix(in oklab, var(--color-accent) 35%, transparent); animation: ring 3.2s ease-out infinite; }
	@keyframes ring { 0% { box-shadow: 0 0 0 0 color-mix(in oklab, var(--color-accent) 35%, transparent); } 100% { box-shadow: 0 0 0 22px transparent; } }
	@media (prefers-reduced-motion: reduce) { .halo-ring, .face { animation: none; } }
	.star { animation: star-in 0.6s var(--ease-out-expo) both; animation-delay: calc(0.9s + var(--d)); filter: drop-shadow(0 1px 2px rgb(245 179 1 / 0.35)); }
	@keyframes star-in { from { opacity: 0; transform: scale(0.4) rotate(-30deg); } to { opacity: 1; transform: none; } }
</style>
