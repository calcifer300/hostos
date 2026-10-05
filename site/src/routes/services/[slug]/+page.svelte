<script lang="ts">
	import { ArrowRight, Check } from 'lucide-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Accordion from '$lib/components/ui/Accordion.svelte';
	import { CTA, SITE } from '$lib/content/site';
	import { CUSTOM_LINE } from '$lib/content/pricing';
	import { descriptionFor, faqFor, fromPrice, headline, serviceLd, servicePath, titleFor } from '$lib/seo/services';

	let { data } = $props();
	const s = $derived(data.service);
	const url = $derived(`${SITE.url}${servicePath(s.id)}`);
	const faq = $derived(faqFor(s));
	const from = $derived(fromPrice(s));
	const title = $derived(titleFor(s));
	const description = $derived(descriptionFor(s));
	const ld = $derived(serviceLd(s));
	const related = $derived(data.others.slice(0, 3));
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta name="robots" content="index, follow, max-image-preview:large" />
	<link rel="canonical" href={url} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={SITE.company} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />
	<meta property="og:image" content={SITE.url + '/opengraph-image'} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={SITE.url + '/opengraph-image'} />
	{@html `<script type="application/ld+json">${ld}</script>`}
</svelte:head>

<article class="pt-28 pb-16 md:pt-36 md:pb-24">
	<div class="container-x">
		<nav aria-label="Breadcrumb" class="label-mono mb-6 text-ink-3">
			<a href="/" class="hover:text-ink">Home</a> <span aria-hidden="true">/</span> <a href="/services" class="hover:text-ink">Services</a> <span aria-hidden="true">/</span> <span class="text-ink-2">{s.name}</span>
		</nav>

		<header class="max-w-3xl">
			<p class="label-mono mb-4 text-accent">{SITE.company}</p>
			<h1 class="display-2 headline">{headline(s)}</h1>
			<!-- the answer first: what it is, for whom, how long, what it costs — the lines an assistant quotes -->
			<p class="mt-5 text-[18px] leading-relaxed text-ink-2">{s.blurb}</p>
			<dl class="mt-8 grid gap-3 sm:grid-cols-3">
				{#if from}<div class="rounded-2xl border border-line bg-surface-2 px-4 py-3"><dt class="label-mono text-ink-3">Price</dt><dd class="mt-1 font-mono text-[18px] font-bold text-accent">{from}</dd></div>{/if}
				{#if s.timeline}<div class="rounded-2xl border border-line bg-surface-2 px-4 py-3"><dt class="label-mono text-ink-3">Timeline</dt><dd class="mt-1 text-[15px] font-semibold text-ink">{s.timeline}</dd></div>{/if}
				{#if s.ideal}<div class="rounded-2xl border border-line bg-surface-2 px-4 py-3 sm:col-span-3"><dt class="label-mono text-ink-3">Best for</dt><dd class="mt-1 text-[15px] text-ink">{s.ideal}</dd></div>{/if}
			</dl>
			<div class="mt-8 flex flex-wrap items-center gap-3">
				<Button href={CTA.href.startsWith('/#') ? `/${CTA.href.slice(1)}` : CTA.href} size="lg">{s.model === 'custom' ? 'Get an estimate' : CTA.label} <ArrowRight class="h-4 w-4" /></Button>
				<span class="label-mono text-ink-3">{CTA.under}</span>
			</div>
		</header>

		{#if s.tiers.length}
			<section class="mt-16" aria-labelledby="pricing-h">
				<h2 id="pricing-h" class="text-[26px] font-bold tracking-tight text-ink">What {s.name.toLowerCase()} costs</h2>
				<ul class="mt-6 grid gap-4 md:grid-cols-3">
					{#each s.tiers as t}
						<li class="rounded-3xl border border-line bg-surface-2 p-6">
							<h3 class="text-[15px] font-semibold text-ink">{t.name}</h3>
							<p class="mt-2"><span class={`font-mono font-bold ${/^\$/.test(t.price) ? 'text-[28px] text-accent' : 'text-[18px] text-ink'}`}>{t.price}</span>{#if t.period}<span class="ml-1 text-[13px] text-ink-3">{t.period}</span>{/if}</p>
							{#if t.note}<p class="mt-2 text-[13.5px] leading-snug text-ink-2">{t.note}</p>{/if}
						</li>
					{/each}
				</ul>
				<p class="mt-4 max-w-3xl text-[14px] leading-relaxed text-ink-2">{s.model === 'custom' ? `${CUSTOM_LINE} ` : ''}{s.why}</p>
				<p class="mt-2 text-[13px] text-ink-3">All prices in USD. Tool subscriptions and ad spend are billed to you directly.{s.support ? ` Support: ${s.support}` : ''}</p>
			</section>
		{/if}

		<div class="mt-16 grid gap-10 md:grid-cols-2">
			{#if s.included.length}
				<section aria-labelledby="included-h">
					<h2 id="included-h" class="text-[22px] font-bold tracking-tight text-ink">What is included</h2>
					<ul class="mt-4 space-y-2.5">
						{#each s.included as it}<li class="flex items-start gap-2.5 text-[15px] leading-relaxed text-ink-2"><Check class="mt-[5px] h-4 w-4 shrink-0 text-accent" strokeWidth={2.5} />{it}</li>{/each}
					</ul>
				</section>
			{/if}
			{#if s.deliverables.length}
				<section aria-labelledby="deliver-h">
					<h2 id="deliver-h" class="text-[22px] font-bold tracking-tight text-ink">What you get</h2>
					<ul class="mt-4 space-y-2.5">
						{#each s.deliverables as it}<li class="flex items-start gap-2.5 text-[15px] leading-relaxed text-ink-2"><Check class="mt-[5px] h-4 w-4 shrink-0 text-accent" strokeWidth={2.5} />{it}</li>{/each}
					</ul>
				</section>
			{/if}
		</div>

		{#if s.stack.length}
			<section class="mt-12" aria-labelledby="stack-h">
				<h2 id="stack-h" class="text-[22px] font-bold tracking-tight text-ink">Tools and technology</h2>
				<ul class="mt-4 flex flex-wrap gap-2">
					{#each s.stack as tech}<li class="rounded-full border border-line bg-surface-2 px-3 py-1.5 font-mono text-[12px] text-ink-2">{tech}</li>{/each}
				</ul>
			</section>
		{/if}

		<section id="faq" class="mt-16 max-w-3xl" aria-labelledby="faq-h">
			<h2 id="faq-h" class="text-[26px] font-bold tracking-tight text-ink">Questions about {s.name.toLowerCase()}</h2>
			<div class="mt-6"><Accordion items={faq} name="svc-faq" /></div>
		</section>

		<section class="mt-16 rounded-3xl border border-line bg-surface-2 p-8 text-center md:p-12" aria-labelledby="cta-h">
			<h2 id="cta-h" class="text-[26px] font-bold tracking-tight text-ink">Talk it through before you decide</h2>
			<p class="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-ink-2">A free 45-minute strategy call with the Founder, John Jenrique Briones. No obligation, and you leave with a practical plan whether or not we work together.</p>
			<div class="mt-6"><Button href="/#contact" size="lg">{CTA.label} <ArrowRight class="h-4 w-4" /></Button></div>
		</section>

		{#if related.length}
			<nav class="mt-16" aria-labelledby="more-h">
				<h2 id="more-h" class="text-[22px] font-bold tracking-tight text-ink">Other services</h2>
				<ul class="mt-4 grid gap-3 md:grid-cols-3">
					{#each related as o}
						<li><a href={servicePath(o.id)} class="block rounded-2xl border border-line bg-surface-2 p-4 transition-colors hover:border-accent/50"><span class="text-[15px] font-semibold text-ink">{o.name}</span><span class="mt-1 block text-[13px] leading-snug text-ink-3">{headline(o)}</span></a></li>
					{/each}
				</ul>
				<p class="mt-4"><a href="/services" class="text-[14px] font-semibold text-accent underline-offset-4 hover:underline">See all services</a></p>
			</nav>
		{/if}
	</div>
</article>
