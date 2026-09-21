<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getContext } from 'svelte';
	import { lazyVideo, near, reveal, words } from '$lib/components/motion/actions';
	import { emph, plain } from '$lib/content/emph';
	import { LANDING_DEFAULTS, type Landing } from '$lib/content/remote';
	/**
	 * The universal section grammar: label → statement → lede → content —
	 * over a living background: a slow, dimmed clip (when the section has
	 * one) under a drift of light in the section's own colour. The Founder
	 * sets both per section; the headline's *asides* are set in the serif.
	 * The header sits left, centred, right, or split (title left, lede right)
	 * — the page changes its stance as it goes, so the eye never settles.
	 */
	let {
		id,
		eyebrow,
		title,
		lede,
		align = 'left',
		wide = false,
		tone = 'bg',
		voice = 'sans',
		class: cls = '',
		children
	}: {
		voice?: 'sans' | 'grotesk' | 'serif' | 'display';
		id?: string;
		eyebrow?: string;
		title?: string;
		lede?: string;
		align?: 'left' | 'center' | 'right' | 'split';
		wide?: boolean;
		tone?: 'bg' | 'surface' | 'light';
		class?: string;
		children: Snippet;
	} = $props();
	const landing = getContext<Landing | undefined>('landing');
	const look = $derived((id && (landing?.sections ?? LANDING_DEFAULTS.sections)[id]) || { clip: '', tint: '#3b9cff' });
	// one entrance per section, so no two titles arrive the same way
	const TITLE_MOTION: Record<string, string> = { problems: 'title-rise', how: 'title-left', film: 'title-zoom', 'before-after': 'title-unclip', solutions: 'title-right', industries: 'title-focus', proof: 'title-flip', voices: 'title-track', platform: 'title-swing', start: 'title-drop', faq: 'title-skew', why: 'title-tilt' };
	const titleMotion = $derived((id && TITLE_MOTION[id]) || 'title-rise');
	const voiceClass = $derived(voice === 'grotesk' ? 'voice-grotesk' : voice === 'serif' ? 'voice-serif' : voice === 'display' ? 'voice-display' : '');
</script>

<section {id} use:near class={`section-y relative isolate scroll-mt-20 ${tone === 'surface' ? 'border-y border-line bg-surface-1' : tone === 'light' ? 'tone-light' : 'bg-bg'} ${cls}`} style={`--tint:${look.tint}`}>
	<div aria-hidden="true" class="section-bg pointer-events-none absolute inset-0 -z-10 overflow-hidden">
		{#if look.clip && tone !== 'light'}{#key look.clip}<video class="lazy dim h-full w-full object-cover" muted loop playsinline preload="none" use:lazyVideo={{ src: look.clip }}></video>{/key}{/if}
	</div>
	<div class={wide ? 'container-wide' : 'container-x'}>
		{#if eyebrow || title}
			<header use:reveal class={`scroll-in mb-10 md:mb-14 ${align === 'center' ? 'mx-auto max-w-3xl text-center' : align === 'right' ? 'ml-auto max-w-3xl text-right' : align === 'split' ? 'grid gap-6 md:grid-cols-[1.2fr_1fr] md:items-end' : 'max-w-3xl'}`}>
				<div>
					{#if eyebrow}<p class="label-mono mb-4 text-accent">{eyebrow}</p>{/if}
					{#if title}<h2 use:words class={`display-2 headline ${voiceClass} ${titleMotion}`} aria-label={plain(title)}>{@html emph(title)}</h2>{/if}
					{#if lede && align !== 'split'}<p class={`mt-5 max-w-2xl text-[17px] leading-relaxed text-ink-2 ${align === 'center' ? 'mx-auto' : align === 'right' ? 'ml-auto' : ''}`}>{lede}</p>{/if}
				</div>
				{#if lede && align === 'split'}<p class="text-[17px] leading-relaxed text-ink-2 md:border-l md:border-line md:pl-6">{lede}</p>{/if}
			</header>
		{/if}
		{@render children()}
	</div>
</section>
