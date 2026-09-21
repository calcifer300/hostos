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
	import Testimonials from '$lib/components/marketing/Testimonials.svelte';
	import Ticker from '$lib/components/marketing/Ticker.svelte';
	import WhyUs from '$lib/components/marketing/WhyUs.svelte';
	import Devices from '$lib/components/marketing/Devices.svelte';
	import { FAQ, SITE } from '$lib/content/site';
	import { jsonLd } from '$lib/seo/jsonld';
	import { setContext } from 'svelte';
	import { listOr } from '$lib/content/remote';

	let { data } = $props();
	// every section and tile reads its footage and light from here
	// svelte-ignore state_referenced_locally — the landing is loaded once per page
	setContext('landing', data);
	// the title carries what people type: the brand, the category, the country
	const title = `${SITE.company} — VA agency & business operations in the Philippines for US businesses | ${SITE.tagline}`;
	const description = 'HostOS Collective is a Philippines-based virtual assistant agency and business solutions team, founded by John Jenrique Briones: trained operators, written systems and the HostOS platform running car rental fleets, restaurants, field services and shops for owners in the US and worldwide.';
	const keywords = 'HostOS Collective, HostOS, John Briones, John Jenrique Briones, VA agency Philippines, virtual assistant agency Philippines, business solutions Philippines, business operations outsourcing, Turo fleet management, DoorDash restaurant operations, field service dispatch, custom web applications Philippines';
	const ld = $derived(jsonLd(data.members));
	const faq = $derived(listOr(data.lists?.faq, FAQ.items, (r) => ({ q: r.a, a: r.b })));
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta name="keywords" content={keywords} />
	<meta name="author" content="John Jenrique Briones" />
	<meta name="robots" content="index, follow, max-image-preview:large" />
	<link rel="canonical" href={SITE.url + '/'} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={SITE.company} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:locale" content="en_US" />
	<meta property="og:url" content={SITE.url + '/'} />
	<meta property="og:image" content={SITE.url + '/opengraph-image'} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={SITE.url + '/opengraph-image'} />
	{@html `<script type="application/ld+json">${ld}</script>`}
</svelte:head>

<Hero heroSrc={data.heroSrc} />
<Problems />
<HowItWorks />
<Film chapters={data.chapters} />
<BeforeAfter />
<Solutions chapters={data.chapters} extras={data.extras} />
<Ticker />
<Industries />
<Proof />
<Testimonials />
<WhyUs />
<PlatformDemo />
<Devices />
<Collective members={data.members} teamSrc={data.extras.team} />
<ThirtyDays />
<Section id="faq" eyebrow={FAQ.eyebrow} title={FAQ.title} align="center" voice="serif">
	<div class="mx-auto max-w-3xl"><Accordion items={faq} /></div>
</Section>
<FinalCta closingSrc={data.extras.closing} />
