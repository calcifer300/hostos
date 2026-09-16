// Built-in fleet roster. Left empty by design — a prior client's 21
// hardcoded vehicles (Audi/VW/Mazda/Toyota, none matching any real trip)
// used to live here and kept resyncing into every host's vehicle table.
// Real fleets are added per-host via CUSTOM_FLEET (see fleetStore.js) or
// discovered from scraped trips, never hardcoded in the extension source.
const FLEET = {};