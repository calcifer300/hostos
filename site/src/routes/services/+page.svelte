<script lang="ts">
	import { ArrowRight } from 'lucide-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { CTA, SITE } from '$lib/content/site';
	import { fromPrice, headline, servicePath, servicesIndexLd } from '$lib/seo/services';

	let { data } = $props();
	const title = `Services & pricing | ${SITE.company}`;
	const description = 'Virtual assistant operations, web and app development, AI automation, CRM, local SEO and design from HostOS Collective, in the Philippines. Clear USD prices for every service.';
	const url = `${SITE.url}/services`;
	const ld = $derived(servicesIndexLd(data.services));
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

<div class="pt-28 pb-16 md:pt-36 md:pb-24">
	<div class="container-x">
		<nav aria-label="Breadcrumb" class="label-mono mb-6 text-ink-3"><a href="/" class="hover:text-ink">Home</a> <span aria-hidden="true">/</span> <span class="text-ink-2">Services</span></nav>
		<header class="max-w-3xl">
			<p class="label-mono mb-4 text-accent">{SITE.company}</p>
			<h1 class="display-2 headline">Services & pricing</h1>
			<p class="mt-5 text-[18px] leading-relaxed text-ink-2">{SITE.description} Every price shows what is included; custom work is quoted after a free 45-minute strategy call.</p>
		</header>

		<ul class="mt-12 grid gap-4 md:grid-cols-2">
			{#each data.services as s (s.id)}
				{@const from = fromPrice(s)}
				<li>
					<a href={servicePath(s.id)} class="group flex h-full flex-col rounded-3xl border border-line bg-surface-2 p-6 transition-colors hover:border-accent/50">
						<h2 class="text-[20px] font-bold tracking-tight text-ink">{s.name}</h2>
						<p class="label-mono mt-1 text-ink-3">{headline(s)}</p>
						<p class="mt-3 text-[14.5px] leading-relaxed text-ink-2">{s.blurb}</p>
						<p class="mt-auto flex items-center justify-between gap-3 pt-5">
							<span class="font-mono text-[15px] font-bold text-accent">{from ?? 'Custom quote'}</span>
							<span class="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink group-hover:text-accent">Details and pricing <ArrowRight class="h-4 w-4" /></span>
						</p>
					</a>
				</li>
			{/each}
		</ul>

		<div class="mt-14 text-center">
			<Button href="/#contact" size="lg">{CTA.label} <ArrowRight class="h-4 w-4" /></Button>
			<p class="label-mono mt-3 text-ink-3">{CTA.under}</p>
		</div>
	</div>
</div>
