<script lang="ts">
	import type { Snippet } from 'svelte';
	import { reveal, words } from '$lib/components/motion/actions';
	/**
	 * The universal section grammar: label → statement → lede → content.
	 * Every section on the site uses it, so the eye learns the rhythm once.
	 */
	let {
		id,
		eyebrow,
		title,
		lede,
		align = 'left',
		wide = false,
		tone = 'bg',
		class: cls = '',
		children
	}: {
		id?: string;
		eyebrow?: string;
		title?: string;
		lede?: string;
		align?: 'left' | 'center';
		wide?: boolean;
		tone?: 'bg' | 'surface';
		class?: string;
		children: Snippet;
	} = $props();
</script>

<section {id} class={`section-y scroll-mt-20 ${tone === 'surface' ? 'border-y border-line bg-surface-1' : ''} ${cls}`}>
	<div class={wide ? 'container-wide' : 'container-x'}>
		{#if eyebrow || title}
			<header use:reveal class={`mb-10 max-w-3xl md:mb-14 ${align === 'center' ? 'mx-auto text-center' : ''}`}>
				{#if eyebrow}<p class="label-mono mb-4 text-accent">{eyebrow}</p>{/if}
				{#if title}<h2 use:words class="display-2 text-ink">{title}</h2>{/if}
				{#if lede}<p class="mt-5 max-w-2xl text-[17px] leading-relaxed text-ink-2 {align === 'center' ? 'mx-auto' : ''}">{lede}</p>{/if}
			</header>
		{/if}
		{@render children()}
	</div>
</section>
