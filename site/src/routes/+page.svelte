<script lang="ts">
	import Hero from '$lib/components/marketing/Hero.svelte';
	import Problems from '$lib/components/marketing/Problems.svelte';
	import HowItWorks from '$lib/components/marketing/HowItWorks.svelte';
	import BeforeAfter from '$lib/components/marketing/BeforeAfter.svelte';
	import Film from '$lib/components/marketing/Film.svelte';
	import Solutions from '$lib/components/marketing/Solutions.svelte';
	import Industries from '$lib/components/marketing/Industries.svelte';
	import Proof from '$lib/components/marketing/Proof.svelte';
	import PlatformDemo from '$lib/components/marketing/PlatformDemo.svelte';
	import Collective from '$lib/components/marketing/Collective.svelte';
	import ThirtyDays from '$lib/components/marketing/ThirtyDays.svelte';
	import Section from '$lib/components/ui/Section.svelte';
	import Accordion from '$lib/components/ui/Accordion.svelte';
	import FinalCta from '$lib/components/marketing/FinalCta.svelte';
	import { FAQ, SITE } from '$lib/content/site';
	import { jsonLd } from '$lib/seo/jsonld';

	let { data } = $props();
	const title = `${SITE.company} — ${SITE.tagline}`;
	const ld = $derived(jsonLd(data.members));
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={SITE.description} />
	<link rel="canonical" href={SITE.url + '/'} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={SITE.company} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={SITE.description} />
	<meta property="og:url" content={SITE.url + '/'} />
	<meta property="og:image" content={SITE.url + '/opengraph-image'} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={SITE.description} />
	<meta name="twitter:image" content={SITE.url + '/opengraph-image'} />
	{@html `<script type="application/ld+json">${ld}</script>`}
</svelte:head>

<Hero heroSrc={data.heroSrc} />
<Problems />
<HowItWorks />
<Film chapters={data.chapters} />
<BeforeAfter />
<Solutions />
<Industries />
<Proof />
<PlatformDemo />
<Collective members={data.members} />
<ThirtyDays />
<Section id="faq" eyebrow={FAQ.eyebrow} title={FAQ.title} align="center">
	<div class="mx-auto max-w-3xl"><Accordion items={FAQ.items} /></div>
</Section>
<FinalCta />
