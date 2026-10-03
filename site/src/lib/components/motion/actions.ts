/**
 * The motion library: four Svelte actions, no runtime dependency.
 * Rule of the house — arrive once, respond always, never idle.
 *
 *   use:reveal            adds .is-in when the element scrolls into view (once)
 *   use:stagger={60}      the same, for each child, 60ms apart
 *   use:tilt              a card leans toward the pointer; a spotlight follows it
 *   use:countUp={n}       a number counts up to n when it comes into view
 */

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function onceInView(el: Element, cb: () => void, margin = '-10% 0px') {
	if (reduced() || typeof IntersectionObserver === 'undefined') {
		cb();
		return () => {};
	}
	const io = new IntersectionObserver(
		([e]) => {
			if (e.isIntersecting) {
				cb();
				io.disconnect();
			}
		},
		{ rootMargin: margin }
	);
	io.observe(el);
	return () => io.disconnect();
}

export function reveal(el: HTMLElement | SVGElement, delay = 0) {
	el.classList.add('reveal');
	if (delay) (el as HTMLElement).style.setProperty('--reveal-delay', `${delay}ms`);
	const stop = onceInView(el, () => el.classList.add('is-in'));
	return { destroy: stop };
}

export function stagger(el: HTMLElement, step = 60) {
	const kids = Array.from(el.children) as HTMLElement[];
	kids.forEach((k, i) => {
		k.classList.add('reveal');
		k.style.setProperty('--reveal-delay', `${i * step}ms`);
	});
	const stop = onceInView(el, () => kids.forEach((k) => k.classList.add('is-in')));
	return { destroy: stop };
}

/** Pointer-follow tilt with a spring, written by hand so it costs ~1 KB. */
export function tilt(el: HTMLElement, max = 7) {
	if (reduced() || window.matchMedia('(hover: none)').matches) return {};
	let rx = 0, ry = 0, tx = 0, ty = 0, raf = 0;
	const k = 0.14; // spring toward the target each frame
	const step = () => {
		rx += (tx - rx) * k;
		ry += (ty - ry) * k;
		el.style.transform = `perspective(1100px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
		if (Math.abs(tx - rx) > 0.05 || Math.abs(ty - ry) > 0.05) raf = requestAnimationFrame(step);
		else raf = 0;
	};
	const kick = () => { if (!raf) raf = requestAnimationFrame(step); };
	const move = (e: PointerEvent) => {
		const r = el.getBoundingClientRect();
		const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
		ty = (x - 0.5) * max * 2;
		tx = (0.5 - y) * max * 2;
		el.style.setProperty('--mx', `${x * 100}%`);
		el.style.setProperty('--my', `${y * 100}%`);
		kick();
	};
	const leave = () => { tx = 0; ty = 0; kick(); };
	el.style.transformStyle = 'preserve-3d';
	el.style.willChange = 'transform';
	el.addEventListener('pointermove', move);
	el.addEventListener('pointerleave', leave);
	return {
		destroy() {
			el.removeEventListener('pointermove', move);
			el.removeEventListener('pointerleave', leave);
			if (raf) cancelAnimationFrame(raf);
		}
	};
}

export function countUp(el: HTMLElement, to: number) {
	const text = el.textContent ?? '';
	const suffix = text.replace(/^[\d.,]+/, '');
	const decimals = (String(to).split('.')[1] ?? '').length;
	const fmt = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
	if (reduced()) { el.textContent = fmt(to); return {}; }
	el.textContent = fmt(0);
	const stop = onceInView(el, () => {
		const start = performance.now(), dur = 1400;
		const tick = (t: number) => {
			const p = Math.min(1, (t - start) / dur);
			const e = 1 - Math.pow(1 - p, 4); // ease-out-quart
			el.textContent = fmt(to * e);
			if (p < 1) requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	});
	return { destroy: stop };
}

/** The primary button leans toward the pointer while it is near — a few pixels, sprung back on leave. */
export function magnetic(el: HTMLElement, strength = 0.28) {
	if (reduced() || window.matchMedia('(hover: none)').matches) return {};
	let raf = 0, tx = 0, ty = 0, x = 0, y = 0;
	const step = () => {
		x += (tx - x) * 0.18; y += (ty - y) * 0.18;
		el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
		if (Math.abs(tx - x) > 0.1 || Math.abs(ty - y) > 0.1) raf = requestAnimationFrame(step); else raf = 0;
	};
	const kick = () => { if (!raf) raf = requestAnimationFrame(step); };
	const move = (e: PointerEvent) => {
		const r = el.getBoundingClientRect();
		tx = (e.clientX - (r.left + r.width / 2)) * strength;
		ty = (e.clientY - (r.top + r.height / 2)) * strength;
		kick();
	};
	const leave = () => { tx = 0; ty = 0; kick(); };
	el.addEventListener('pointermove', move);
	el.addEventListener('pointerleave', leave);
	return { destroy() { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); if (raf) cancelAnimationFrame(raf); } };
}

/** Splits a heading into words, each rising out of its own clipped line when the heading scrolls into view. */
export function words(el: HTMLElement, step = 45) {
	const text = el.textContent ?? '';
	if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', text);
	// each word rides its own plate; a word inside an <em> keeps the <em> (the serif aside)
	let n = 0;
	const plate = (inner: string) => `<span class="plate" aria-hidden="true" style="display:inline-block;vertical-align:top;--reveal-delay:${n++ * step}ms"><span>${inner}</span></span>`;
	const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	const split = (s: string, wrap: (w: string) => string) => s.split(/(\s+)/).map((w) => (/^\s+$/.test(w) ? ' ' : w === '' ? '' : plate(wrap(esc(w))))).join('');
	el.innerHTML = Array.from(el.childNodes)
		.map((node) => (node instanceof HTMLElement ? split(node.textContent ?? '', (w) => `<${node.tagName.toLowerCase()}>${w}</${node.tagName.toLowerCase()}>`) : split(node.textContent ?? '', (w) => w)))
		.join('');
	const stop = onceInView(el, () => el.querySelectorAll('.plate').forEach((p) => p.classList.add('is-in')));
	return { destroy: stop };
}

/**
 * A video that costs nothing until it is needed: the src is attached only
 * when the element nears the viewport, and it never loads at all under
 * reduced motion or data saver. Fades in on its first frame.
 *
 * Footage behind something the visitor reads must not move on its own, so
 * `still` shows one frame and holds it (a photograph, at a clip's cost),
 * and `hover` lets that frame play while the pointer is over the card and
 * settle again when it leaves. Without either, the clip plays while on
 * screen — the hero, the film and the collage, where the motion is the point.
 * (`always` is kept for callers; every screen size gets the footage.)
 */
export function lazyVideo(video: HTMLVideoElement, opts: { src: string; always?: boolean; still?: boolean; hover?: boolean }) {
	const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
	// phones get the footage too (the clips are SD and load only as they near the screen); data saver never does; reduced motion only ever sees a still
	if (nav.connection?.saveData) return {};
	const still = opts.still || opts.hover || reduced();
	const hover = opts.hover && !reduced();
	let loaded = false;
	let onScreen = false;
	// the frame a still shows: a little way in, past any fade-from-black
	const settle = () => { if (video.currentTime < 0.4) video.currentTime = 0.6; };
	const onLoaded = () => { settle(); if (!still) video.play().catch(() => {}); else video.classList.add('is-playing'); };
	const io = new IntersectionObserver(([e]) => {
		onScreen = e.isIntersecting;
		if (onScreen) {
			if (!loaded) { video.src = opts.src; video.preload = 'metadata'; video.load(); loaded = true; }
			else if (!still) video.play().catch(() => {});
		} else video.pause();
	}, { rootMargin: '200px 0px' });
	io.observe(video);
	const onPlay = () => video.classList.add('is-playing');
	video.addEventListener('loadeddata', onLoaded);
	video.addEventListener('playing', onPlay);
	// hover: the card the clip sits in, or the clip itself
	const host = (video.parentElement ?? video) as HTMLElement;
	const enter = () => { if (loaded && onScreen) video.play().catch(() => {}); };
	const leave = () => { video.pause(); };
	if (hover) { host.addEventListener('pointerenter', enter); host.addEventListener('pointerleave', leave); }
	return {
		destroy() {
			io.disconnect();
			video.removeEventListener('loadeddata', onLoaded);
			video.removeEventListener('playing', onPlay);
			if (hover) { host.removeEventListener('pointerenter', enter); host.removeEventListener('pointerleave', leave); }
		}
	};
}

/** Marks an element `is-near` while it is within half a screen of the viewport: its light, its footage and its motifs run only then. */
export function near(el: HTMLElement, margin = '40% 0px') {
	const io = new IntersectionObserver(([e]) => el.classList.toggle('is-near', e.isIntersecting), { rootMargin: margin });
	io.observe(el);
	return { destroy() { io.disconnect(); } };
}
