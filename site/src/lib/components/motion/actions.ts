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

export function reveal(el: HTMLElement, delay = 0) {
	el.classList.add('reveal');
	if (delay) el.style.setProperty('--reveal-delay', `${delay}ms`);
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
