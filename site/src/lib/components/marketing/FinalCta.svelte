<script lang="ts">
	import { ArrowRight, Mail, MessageCircle } from 'lucide-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { lazyVideo, reveal } from '$lib/components/motion/actions';
	import { FINAL, SITE, VIDEO } from '$lib/content/site';
	import { emph, plain } from '$lib/content/emph';
	import { getContext } from 'svelte';
	import { LANDING_DEFAULTS, type Landing } from '$lib/content/remote';
	const landing = getContext<Landing | undefined>('landing');
	const contact = $derived(landing?.copy?.contact ?? LANDING_DEFAULTS.copy.contact);
	let { closingSrc = VIDEO.closing }: { closingSrc?: string } = $props();
	/**
	 * The one ask. The form posts to the app's contact endpoint (same origin
	 * once the site fronts the domain; until then it opens mail). Calendar
	 * embed goes here when the Founder chooses one.
	 */
	let sending = $state(false);
	let done = $state(false);
	let error = $state('');
	async function submit(e: SubmitEvent) {
		e.preventDefault();
		const form = e.currentTarget as HTMLFormElement;
		const data = Object.fromEntries(new FormData(form).entries());
		if (data.company_website) return; // honeypot
		sending = true; error = '';
		try {
			const r = await fetch('/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
			if (!r.ok) throw new Error();
			done = true;
		} catch {
			window.location.href = `mailto:${SITE.email}?subject=${encodeURIComponent('Working session — ' + (data.business || ''))}&body=${encodeURIComponent(String(data.operation || ''))}`;
		} finally {
			sending = false;
		}
	}
</script>

<section id="contact" class="aurora section-y relative overflow-hidden bg-bg">
	<div aria-hidden="true" class="pointer-events-none absolute inset-0 -z-20">
		<video class="lazy dim h-full w-full object-cover [mask-image:radial-gradient(ellipse_at_center,#000_20%,transparent_75%)]" style="--dim:0.36" muted loop playsinline preload="none" use:lazyVideo={{ src: closingSrc }}></video>
	</div>
	<div aria-hidden="true" class="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-accent)_16%,transparent),transparent)] blur-3xl"></div>
	<div class="container-x grid items-start gap-12 lg:grid-cols-[1fr_1fr]">
		<div use:reveal>
			<p class="label-mono mb-4 text-accent">Start here</p>
			<h2 class="display-1 headline" aria-label={plain(FINAL.title)}>{@html emph(FINAL.title)}</h2>
			<p class="mt-6 max-w-[48ch] text-[17px] leading-relaxed text-ink-2 md:text-[19px]">{FINAL.body}</p>
			<!-- the Founder, directly: his Facebook and his own inbox -->
			<a href={contact.facebookUrl} target="_blank" rel="noopener" class="mt-8 flex items-center gap-4 rounded-2xl border border-line bg-surface-2/80 p-4 transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-accent/60">
				<span class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#1877f2] text-white"><svg viewBox="0 0 24 24" class="h-5 w-5" fill="currentColor" aria-hidden="true"><path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.6 1.6-1.6h1.7V4.4c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.2v2.3H7.4V14h2.8v8z" /></svg></span>
				<span class="min-w-0"><span class="block text-[15px] font-semibold text-ink">John Briones on Facebook</span><span class="block text-[13px] text-ink-3">{contact.facebookHandle} · message me directly, I read every one</span></span>
			</a>
			<ul class="mt-4 space-y-2">
				<li><a href={`mailto:${contact.founderEmail}`} class="inline-flex items-center gap-2.5 text-[15px] text-ink-2 transition-colors hover:text-ink"><Mail class="h-4 w-4 text-accent" /><span class="label-mono text-ink-3">Founder</span>{contact.founderEmail}</a></li>
				{#each FINAL.channels as c}
					<li><a href={c.href} class="inline-flex items-center gap-2.5 text-[15px] text-ink-2 transition-colors hover:text-ink">{#if c.label === 'Email'}<Mail class="h-4 w-4 text-accent" />{:else}<MessageCircle class="h-4 w-4 text-accent" />{/if}<span class="label-mono w-20 text-ink-3">{c.label}</span>{c.value}</a></li>
				{/each}
			</ul>
		</div>
		<form use:reveal={150} onsubmit={submit} class="rounded-3xl border border-line bg-surface-2 p-6 shadow-2 md:p-8" aria-label="Book a working session">
			{#if done}
				<div class="py-10 text-center" role="status">
					<p class="text-[22px] font-semibold text-ink">Got it. We’ll reply within one working day.</p>
					<p class="mt-2 text-[14px] text-ink-2">Have the operation you named ready — we’ll map it on the call.</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<label class="block text-[13px] font-medium text-ink-2">Your name<input name="name" required autocomplete="name" class="field" /></label>
					<label class="block text-[13px] font-medium text-ink-2">Email<input name="email" type="email" required autocomplete="email" class="field" /></label>
					<label class="block text-[13px] font-medium text-ink-2 sm:col-span-2">Business<input name="business" required placeholder="e.g. 6-car Turo fleet in Austin" class="field" /></label>
					<label class="block text-[13px] font-medium text-ink-2 sm:col-span-2">The one operation to bring<textarea name="operation" rows="3" required placeholder="What runs badly, or takes your evenings" class="field"></textarea></label>
					<label class="hidden" aria-hidden="true">Website<input name="company_website" tabindex="-1" autocomplete="off" /></label>
				</div>
				{#if error}<p class="mt-3 text-[13px] text-danger" role="alert">{error}</p>{/if}
				<div class="mt-5 flex flex-wrap items-center gap-4">
					<Button type="submit" size="lg" loading={sending}>Book the session <ArrowRight class="h-4 w-4" /></Button>
					<p class="label-mono text-ink-3">45 min · free · you keep the map</p>
				</div>
			{/if}
		</form>
	</div>
</section>

<style>
	:global(.field) {
		margin-top: 6px;
		display: block;
		width: 100%;
		border-radius: 12px;
		border: 1px solid var(--color-line-strong);
		background: var(--color-bg);
		padding: 11px 14px;
		font-size: 15px;
		color: var(--color-ink);
		transition: border-color 0.2s var(--ease-standard), box-shadow 0.2s var(--ease-standard);
	}
	:global(.field::placeholder) {
		color: var(--color-ink-3);
	}
	:global(.field:focus) {
		outline: none;
		border-color: var(--color-accent);
		box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-accent) 25%, transparent);
	}
</style>
