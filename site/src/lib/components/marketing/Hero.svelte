<script lang="ts">
	import { ArrowDown, ArrowRight } from 'lucide-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import LiveBoard from './LiveBoard.svelte';
	import { lazyVideo, magnetic } from '$lib/components/motion/actions';
	import { CTA, HERO, LOGOS, VIDEO } from '$lib/content/site';
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
		<video bind:this={video} class="lazy h-full w-full object-cover opacity-30 [mask-image:radial-gradient(ellipse_at_center,#000_30%,transparent_75%)]" muted loop playsinline preload="none" use:lazyVideo={{ src: heroSrc }}></video>
		<div class="absolute inset-0 bg-[linear-gradient(180deg,var(--color-bg)_0%,transparent_30%,transparent_60%,var(--color-bg)_100%)]"></div>
	</div>
	<div aria-hidden="true" class="pointer-events-none absolute inset-0 bg-[linear-gradient(var(--color-line)_1px,transparent_1px),linear-gradient(90deg,var(--color-line)_1px,transparent_1px)] bg-[size:72px_72px] opacity-30 [mask-image:radial-gradient(ellipse_at_top,#000_20%,transparent_70%)]"></div>
	<div aria-hidden="true" class="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-accent)_22%,transparent),transparent)] blur-3xl"></div>

	<div class="container-wide grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
		<div>
			<p class="arrive label-mono mb-6 text-accent">{HERO.eyebrow}</p>
			<h1 class="display-1 text-ink">
				{#each HERO.lines as line, i}
					<span class="plate is-in"><span style={`--reveal-delay:${120 + i * 110}ms`} class={i === HERO.lines.length - 1 ? 'italic-serif text-gradient' : ''}>{line}</span></span>
				{/each}
			</h1>
			<p class="arrive mt-7 max-w-[52ch] text-[17px] leading-relaxed text-ink-2 md:text-[19px]" style="--reveal-delay:380ms">{HERO.body}</p>
			<div class="arrive mt-9 flex flex-wrap items-center gap-3" style="--reveal-delay:520ms">
				<span use:magnetic class="inline-block"><Button href={CTA.href} size="lg">{CTA.label} <ArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></Button></span>
				<Button href={HERO.secondary.href} variant="ghost" size="lg">{HERO.secondary.label} <ArrowDown class="h-4 w-4" /></Button>
			</div>
			<p class="arrive label-mono mt-5 text-ink-3" style="--reveal-delay:640ms">{CTA.under}</p>
		</div>
		<div class="arrive relative" style="--reveal-delay:300ms">
			<div aria-hidden="true" class="absolute -inset-6 -z-10 rounded-[40px] bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-platform)_18%,transparent),transparent)] blur-2xl"></div>
			<div class="float motion-reduce:animate-none"><LiveBoard /></div>
		</div>
	</div>

	<div class="arrive container-x mt-16 md:mt-24" style="--reveal-delay:700ms">
		<p class="label-mono mb-4 text-center text-ink-3">Runs on the platforms your business already uses</p>
		<div class="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
			<ul class="flex w-max gap-10 animate-marquee motion-reduce:animate-none" aria-label="Platforms">
				{#each [...LOGOS, ...LOGOS] as name, i}
					<li aria-hidden={i >= LOGOS.length} class="text-[15px] font-semibold tracking-tight text-ink-3">{name}</li>
				{/each}
			</ul>
		</div>
	</div>
</section>
