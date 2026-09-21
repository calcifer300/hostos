<script lang="ts">
	import { ArrowRight, Check } from 'lucide-svelte';
	import { getContext } from 'svelte';
	import Section from '$lib/components/ui/Section.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { stagger, tilt } from '$lib/components/motion/actions';
	import { CTA } from '$lib/content/site';
	import { PRICING, SERVICES, type Service } from '$lib/content/pricing';
	import { LANDING_DEFAULTS, type Landing } from '$lib/content/remote';
	/**
	 * Services and prices, one card each: what it is, what it runs on, what is
	 * included, the tiers, and why the price is what it is. Custom work shows
	 * a quote, never a number. The Founder edits every field in Settings.
	 */
	const landing = getContext<Landing | undefined>('landing');
	const services = $derived<Service[]>((landing?.services?.length ? landing.services : LANDING_DEFAULTS.services) as Service[]);
	let open = $state<string | null>(null);
</script>

<Section id="pricing" eyebrow={PRICING.eyebrow} title={PRICING.title} lede={PRICING.lede} tone="surface" wide>
	<div use:stagger={60} class="scroll-in grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
		{#each services as s (s.id)}
			<article use:tilt={3} class="spot ring-hover flex flex-col rounded-3xl border border-line bg-surface-2 p-6 transition-[border-color] duration-300 hover:border-accent/50">
				<header>
					<h3 class="text-[20px] font-bold tracking-tight text-ink">{s.name}</h3>
					<p class="mt-2 text-[14px] leading-relaxed text-ink-2">{s.blurb}</p>
				</header>

				<!-- the price: tiers, or a floor, or a quote -->
				<ul class="mt-5 space-y-2">
					{#each s.tiers as t}
						<li class="rounded-2xl border border-line bg-surface-3 px-4 py-3">
							<div class="flex items-baseline justify-between gap-3">
								<span class="text-[13px] font-semibold text-ink">{t.name}</span>
								<span class="text-right"><span class={`font-mono font-bold ${/^\$/.test(t.price) ? 'text-[20px] text-accent' : 'text-[13px] text-ink'}`}>{t.price}</span>{#if t.period}<span class="ml-1 text-[12px] text-ink-3">{t.period}</span>{/if}</span>
							</div>
							{#if t.note}<p class="mt-1 text-[12.5px] leading-snug text-ink-3">{t.note}</p>{/if}
						</li>
					{/each}
				</ul>

				<!-- what runs it -->
				<ul class="mt-5 flex flex-wrap gap-1.5" aria-label="Technologies">
					{#each s.stack as tech}<li class="rounded-full border border-line bg-bg px-2.5 py-1 font-mono text-[10.5px] text-ink-2">{tech}</li>{/each}
				</ul>

				<!-- included -->
				<ul class="mt-5 space-y-1.5">
					{#each s.included as it}<li class="flex items-start gap-2 text-[13.5px] text-ink-2"><Check class="mt-[3px] h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2.5} />{it}</li>{/each}
				</ul>

				<!-- the rest, on request -->
				<button type="button" class="mt-4 self-start text-[13px] font-semibold text-accent underline-offset-4 hover:underline" aria-expanded={open === s.id} aria-controls={`svc-${s.id}`} onclick={() => (open = open === s.id ? null : s.id)}>{open === s.id ? 'Less' : 'Deliverables, timeline and why this price'}</button>
				{#if open === s.id}
					<div id={`svc-${s.id}`} class="mt-3 space-y-3 text-[13px] leading-relaxed text-ink-2">
						<p><span class="label-mono mr-2 text-ink-3">You get</span>{s.deliverables.join(' · ')}</p>
						<p><span class="label-mono mr-2 text-ink-3">Ideal for</span>{s.ideal}</p>
						<p><span class="label-mono mr-2 text-ink-3">Timeline</span>{s.timeline}</p>
						<p><span class="label-mono mr-2 text-ink-3">Support</span>{s.support}</p>
						<p><span class="label-mono mr-2 text-ink-3">Why this price</span>{s.why}</p>
					</div>
				{/if}

				<div class="mt-auto pt-6">
					<Button href={CTA.href} variant={s.id === 'operations' ? 'primary' : 'secondary'} class="w-full justify-center">{s.model === 'custom' ? 'Get an estimate' : 'Book a Free Strategy Call'} <ArrowRight class="h-4 w-4" /></Button>
				</div>
			</article>
		{/each}
	</div>
	<p class="mx-auto mt-10 max-w-3xl text-center text-[14px] leading-relaxed text-ink-3">Prices in USD. Tool subscriptions and ad spend are billed to you directly. Every engagement starts with a Free Strategy Call — 45 minutes, no obligation, and you keep the plan either way.</p>
</Section>
