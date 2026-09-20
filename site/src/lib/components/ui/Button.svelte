<script lang="ts">
	import type { Snippet } from 'svelte';
	/**
	 * One button, four voices. Primary is the only saturated colour on the
	 * page — it means "act". `loading` swaps the label without changing width.
	 */
	let {
		href,
		variant = 'primary',
		size = 'md',
		loading = false,
		disabled = false,
		type = 'button',
		class: cls = '',
		children,
		...rest
	}: {
		href?: string;
		variant?: 'primary' | 'secondary' | 'ghost' | 'link';
		size?: 'sm' | 'md' | 'lg';
		loading?: boolean;
		disabled?: boolean;
		type?: 'button' | 'submit';
		class?: string;
		children: Snippet;
		[key: string]: unknown;
	} = $props();

	const base = 'group relative inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-[var(--ease-standard)] focus-visible:outline-2 disabled:pointer-events-none disabled:opacity-50';
	const variants = {
		primary: 'bg-accent text-accent-ink shadow-[0_8px_24px_-10px_var(--color-accent)] hover:-translate-y-px hover:shadow-[0_12px_28px_-10px_var(--color-accent)] active:translate-y-0',
		secondary: 'border border-line-strong bg-surface-2 text-ink hover:border-accent/60 hover:bg-surface-3',
		ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
		link: 'text-accent underline-offset-4 hover:underline'
	};
	const sizes = { sm: 'h-9 px-4 text-[13px]', md: 'h-11 px-5 text-[14px]', lg: 'h-13 px-7 text-[15px]' };
	const classes = $derived(`${base} ${variants[variant]} ${sizes[size]} ${cls}`);
</script>

{#if href}
	<a {href} class={classes} aria-disabled={disabled || undefined} {...rest}>
		{@render children()}
	</a>
{:else}
	<button {type} class={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
		<span class={loading ? 'invisible' : ''}>{@render children()}</span>
		{#if loading}
			<span class="absolute inset-0 flex items-center justify-center gap-1" aria-hidden="true">
				{#each [0, 1, 2] as i}<span class="h-1.5 w-1.5 rounded-full bg-current animate-blink" style={`animation-delay:${i * 150}ms`}></span>{/each}
			</span>
		{/if}
	</button>
{/if}
