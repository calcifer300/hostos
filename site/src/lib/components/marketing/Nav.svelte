<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowRight, Menu, X } from 'lucide-svelte';
	import Logo from '$lib/components/ui/Logo.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { CTA, NAV, SITE } from '$lib/content/site';

	/**
	 * Session-aware: after mount it asks the app whether a session exists (same
	 * origin once the site fronts hostoscollective.com; until then it fails
	 * quietly and shows "Sign in"). Scrolling condenses the bar.
	 */
	let user = $state<{ name?: string | null; image?: string | null } | null>(null);
	let scrolled = $state(false);
	let open = $state(false);

	onMount(() => {
		const onScroll = () => (scrolled = window.scrollY > 24);
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		// only where the app answers on this origin (the site fronting hostoscollective.com, or the app's dev server)
		const appOrigin = /(^|.)hostoscollective.com$/.test(location.hostname) || location.port === '3000';
		if (appOrigin) fetch('/api/auth/session', { credentials: 'same-origin' })
			.then((r) => (r.ok ? r.json() : null))
			.then((s) => { if (s?.user) user = s.user; })
			.catch(() => {});
		return () => window.removeEventListener('scroll', onScroll);
	});
	$effect(() => { document.body.style.overflow = open ? 'hidden' : ''; });
</script>

<header class="fixed inset-x-0 top-0 z-50 px-4 pt-4" style="padding-top: max(16px, env(safe-area-inset-top))">
	<div class={`container-wide flex h-14 items-center justify-between rounded-full border px-4 backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-300 ${scrolled ? 'border-line bg-bg/70 shadow-2' : 'border-transparent bg-transparent'}`}>
		<a href="/" class="rounded-full" aria-label="HostOS Collective — home"><Logo /></a>
		<nav aria-label="Primary" class="hidden items-center gap-1 lg:flex">
			{#each NAV as l}
				<a href={l.href} class="rounded-full px-3.5 py-2 text-[13.5px] font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">{l.label}</a>
			{/each}
		</nav>
		<div class="hidden items-center gap-2 lg:flex">
			{#if user}
				<Button href={SITE.app} size="sm">{#if user.image}<img src={user.image} alt="" width="20" height="20" class="rounded-full" />{/if}Open HostOS <ArrowRight class="h-4 w-4" /></Button>
			{:else}
				<Button href={SITE.login} variant="ghost" size="sm">Sign in</Button>
				<Button href={CTA.href} size="sm">{CTA.label} <ArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></Button>
			{/if}
		</div>
		<button type="button" class="flex h-10 w-10 items-center justify-center rounded-full text-ink lg:hidden" aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? 'Close menu' : 'Open menu'} onclick={() => (open = !open)}>
			{#if open}<X class="h-5 w-5" />{:else}<Menu class="h-5 w-5" />{/if}
		</button>
	</div>
	{#if open}
		<div id="mobile-menu" class="container-wide mt-2 rounded-3xl border border-line bg-bg/95 p-4 shadow-2 backdrop-blur-xl lg:hidden">
			<nav aria-label="Primary" class="flex flex-col">
				{#each NAV as l}
					<a href={l.href} class="rounded-xl px-3 py-3 text-[16px] font-medium text-ink" onclick={() => (open = false)}>{l.label}</a>
				{/each}
			</nav>
			<div class="mt-3 flex flex-col gap-2 border-t border-line pt-3">
				{#if user}
					<Button href={SITE.app}>Open HostOS <ArrowRight class="h-4 w-4" /></Button>
				{:else}
					<Button href={CTA.href}>{CTA.label} <ArrowRight class="h-4 w-4" /></Button>
					<Button href={SITE.login} variant="secondary">Sign in</Button>
				{/if}
			</div>
		</div>
	{/if}
</header>
