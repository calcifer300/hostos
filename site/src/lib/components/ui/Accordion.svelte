<script lang="ts">
	import { Plus } from 'lucide-svelte';
	/** One open at a time, height animated, keyboard-native (it is a button). */
	let { items, name = 'faq' }: { items: { q: string; a: string }[]; name?: string } = $props();
	let open = $state<number | null>(0);
</script>

<div class="divide-y divide-line border-y border-line">
	{#each items as it, i}
		{@const isOpen = open === i}
		<div>
			<h3>
				<button
					type="button"
					class="flex w-full items-center gap-5 py-5 text-left transition-colors hover:text-ink"
					aria-expanded={isOpen}
					aria-controls={`${name}-${i}`}
					onclick={() => (open = isOpen ? null : i)}
				>
					<span class="label-mono w-8 shrink-0 text-ink-3">{String(i + 1).padStart(2, '0')}</span>
					<span class="flex-1 text-[17px] font-medium text-ink">{it.q}</span>
					<Plus class={`h-4 w-4 shrink-0 text-accent transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`} />
				</button>
			</h3>
			<div id={`${name}-${i}`} class="grid transition-[grid-template-rows] duration-400 ease-[var(--ease-out-expo)]" style={`grid-template-rows:${isOpen ? '1fr' : '0fr'}`} inert={!isOpen}>
				<div class="overflow-hidden">
					<p class="pb-6 pl-13 pr-10 text-[15px] leading-relaxed text-ink-2">{it.a}</p>
				</div>
			</div>
		</div>
	{/each}
</div>
