<script lang="ts">
	import { ArrowDown, ArrowRight } from 'lucide-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import LiveBoard from './LiveBoard.svelte';
	import { lazyVideo, magnetic } from '$lib/components/motion/actions';
	import { CLIENT_FACES, CTA, HERO, LOGOS, VIDEO } from '$lib/content/site';
	import Logo from '$lib/components/ui/Logo.svelte';
	import Laurel from '$lib/components/ui/Laurel.svelte';
	import { emph, plain } from '$lib/content/emph';
	import { getContext } from 'svelte';
	import { LANDING_DEFAULTS, listOr, type Landing } from '$lib/content/remote';
	const landing = getContext<Landing | undefined>('landing');
	const copy = $derived(landing?.copy ?? LANDING_DEFAULTS.copy);
	const lines = $derived([copy.hero.line1, copy.hero.line2]);
	const lists = $derived(landing?.lists ?? LANDING_DEFAULTS.lists);
	const faces = $derived(listOr(lists.faces, CLIENT_FACES, (r) => r.a));
	const outcomes = $derived(listOr(lists.outcomes, HERO.outcomes as [string, string][], (r) => [r.a, r.b] as [string, string]));
	const laurels = $derived(landing?.laurels ?? LANDING_DEFAULTS.laurels);
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

<section id="hero" bind:this={stage} class="hero-stage relative overflow-hidden pt-28 pb-16 md:pt-32 md:pb-24" style={`--hero-top:${top}px`}>
	<!-- footage: a road at dusk, far behind the copy, only on wide screens and only when allowed -->
	<div aria-hidden="true" class="pointer-events-none absolute inset-0 -z-20">
		<video bind:this={video} class="lazy dim h-full w-full object-cover [mask-image:radial-gradient(ellipse_at_center,#000_30%,transparent_75%)]" style="--dim:0.14" muted loop playsinline preload="none" use:lazyVideo={{ src: heroSrc }}></video>
		<div class="absolute inset-0 bg-[linear-gradient(180deg,var(--color-bg)_0%,transparent_30%,transparent_60%,var(--color-bg)_100%)]"></div>
	</div>
	<div aria-hidden="true" class="pointer-events-none absolute inset-0 bg-[linear-gradient(var(--color-line)_1px,transparent_1px),linear-gradient(90deg,var(--color-line)_1px,transparent_1px)] bg-[size:72px_72px] opacity-30 [mask-image:radial-gradient(ellipse_at_top,#000_20%,transparent_70%)]"></div>
	<div aria-hidden="true" class="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-accent)_22%,transparent),transparent)] blur-3xl"></div>

	<div class="container-x text-center">
		<!-- the mark, large: the brand greets before the words do -->
		<div class="arrive hero-mark mx-auto mb-6 flex justify-center">
			<div class="flex flex-col items-center">
				<Logo size={64} wordSize={38} class="gap-3.5" />
				<span class="collective-word mt-1.5 text-[11px] font-semibold uppercase tracking-[0.42em] text-ink-3" aria-hidden="true">Collective</span>
			</div>
		</div>
		<p class="arrive label-mono mb-6 text-accent" style="--reveal-delay:60ms">{copy.hero.eyebrow}</p>
		<h1 class="display-1 headline mx-auto max-w-5xl" aria-label={lines.map(plain).join(' ')}>
			{#each lines as line, i}
				<span class="plate is-in" aria-hidden="true"><span style={`--reveal-delay:${40 + i * 80}ms`}>{@html emph(line)}</span></span>
			{/each}
		</h1>
		<p class="arrive mx-auto mt-7 max-w-[64ch] text-[17px] leading-relaxed text-ink-2 md:text-[20px]" style="--reveal-delay:220ms">{copy.hero.body}</p>
		<!-- the laurels, in gold, under the paragraph -->
		<ul class="arrive mx-auto mt-7 grid max-w-4xl grid-cols-2 gap-x-2 gap-y-3 sm:flex sm:flex-wrap sm:items-stretch sm:justify-center sm:gap-2.5" style="--reveal-delay:280ms" aria-label="Figures">
			{#each laurels as l, i}
				<!-- on phones the figures pair up; an odd last one takes the full row so its laurels frame it -->
				<li class={`laurel-gold flex items-center justify-center gap-1 px-1 py-1 sm:px-2 ${i === laurels.length - 1 && laurels.length % 2 ? "col-span-2" : ""}`} style={`--d:${i * 70}ms`}>
					<Laurel class="h-9 w-5 sm:h-11 sm:w-6" />
					<span class="text-center"><span class="crown block"><svg viewBox="0 0 24 24" class="mx-auto -mb-0.5 h-3.5 w-3.5 drop-shadow-[0_1px_1px_rgba(120,80,0,0.35)]" aria-hidden="true"><path class="gold-fill" d="M3 18h18l1-10-5.5 4L12 5l-4.5 7L2 8z" /></svg></span><span class="gold-text block font-mono text-[17px] font-bold leading-none">{l.value}</span><span class="label-mono mt-0.5 block !text-[9.5px] text-ink-3">{l.label}</span></span>
					<Laurel flip class="h-9 w-5 sm:h-11 sm:w-6" />
				</li>
			{/each}
		</ul>
		<div class="arrive mt-9 flex flex-wrap items-center justify-center gap-3" style="--reveal-delay:340ms">
			<span use:magnetic class="inline-block"><Button href={CTA.href} size="lg">{CTA.label} <ArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></Button></span>
			<Button href={HERO.secondary.href} variant="ghost" size="lg">{HERO.secondary.label} <ArrowDown class="h-4 w-4" /></Button>
		</div>
		<p class="arrive label-mono mt-5 text-ink-3" style="--reveal-delay:400ms">{CTA.under}</p>
		<!-- the trust line: the faces of owners who said so, five stars, the count -->
		<div class="arrive mx-auto mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-3" style="--reveal-delay:440ms" aria-label="{copy.rating.value ? `Rated ${copy.rating.value} — ` : ''}{copy.rating.note}">
			{#if faces.length}<span class="flex -space-x-2.5">{#each faces as f, i}<img src={f} alt="" width="32" height="32" loading="lazy" class="face h-8 w-8 rounded-full border-2 border-bg object-cover" style={`--d:${i * 60}ms`} />{/each}</span>{/if}
			<span class="shine flex items-center gap-1.5 rounded-full px-1" aria-hidden="true">
				<svg width="0" height="0" class="absolute"><defs><linearGradient id="gold-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3b0" /><stop offset="0.35" stop-color="#f4c542" /><stop offset="0.65" stop-color="#d69e12" /><stop offset="1" stop-color="#fbe58a" /></linearGradient></defs></svg>
				{#each [1, 2, 3, 4, 5] as s}<svg viewBox="0 0 20 20" class="star h-[18px] w-[18px] drop-shadow-[0_1px_1px_rgba(120,80,0,0.35)]" style={`--d:${s * 90}ms`}><path class="gold-fill" d="M10 1.6l2.5 5.3 5.8.7-4.3 4 1.1 5.8L10 14.6l-5.1 2.8 1.1-5.8-4.3-4 5.8-.7z" /></svg>{/each}
			</span>
			<span class="text-[14.5px] font-medium text-ink">{#if copy.rating.value}<span class="font-mono font-bold">{copy.rating.value}</span> {/if}{copy.rating.note}{#if copy.rating.count}<span class="mx-2 text-ink-3">·</span><span class="font-normal text-ink-2">{copy.rating.count}</span>{/if}</span>
		</div>
		<!-- what is in it for them, in four figures -->
		<ul class="arrive mx-auto mt-8 flex max-w-4xl flex-wrap items-baseline justify-center gap-x-6 gap-y-2 text-[13.5px] text-ink-2" style="--reveal-delay:480ms" aria-label="What you get">
			{#each outcomes as [figure, what], i}
				<li class="flex items-baseline gap-2"><span class="font-mono text-[15px] font-bold text-ink">{figure}</span>{what}{#if i < outcomes.length - 1}<span aria-hidden="true" class="ml-4 hidden text-ink-3 sm:inline">·</span>{/if}</li>
			{/each}
		</ul>
	</div>
	<div class="arrive container-x mt-14 md:mt-20" style="--reveal-delay:200ms">
		<div class="relative mx-auto max-w-3xl">
			<div aria-hidden="true" class="absolute -inset-6 -z-10 rounded-[40px] bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-platform)_18%,transparent),transparent_70%)]"></div>
			<LiveBoard />
		</div>
	</div>

	<div class="arrive container-x mt-16 md:mt-24" style="--reveal-delay:520ms">
		<p class="label-mono mb-4 text-center text-ink-3">Works with the platforms you already use</p>
		<div class="relative">
			<ul class="flex flex-wrap justify-center gap-x-8 gap-y-3 md:gap-x-10" aria-label="Platforms">
				{#each LOGOS as l}
					<li class="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink-3">
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
	@media (prefers-reduced-motion: reduce) { .face { animation: none; } }
	.laurel-gold { animation: laurel-in 0.6s var(--ease-out-expo) both; animation-delay: calc(0.5s + var(--d)); }
	@keyframes laurel-in { from { opacity: 0; transform: translateY(10px) scale(0.92); } to { opacity: 1; transform: none; } }
	.star { animation: star-in 0.6s var(--ease-out-expo) both; animation-delay: calc(0.9s + var(--d)); filter: drop-shadow(0 1px 2px rgb(245 179 1 / 0.35)); }
	@keyframes star-in { from { opacity: 0; transform: scale(0.4) rotate(-30deg); } to { opacity: 1; transform: none; } }
</style>
