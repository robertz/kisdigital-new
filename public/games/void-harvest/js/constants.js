// ── Starting resources ──────────────────────────────────────────────────
export const INITIAL_CREDITS = 400;
export const INITIAL_ORE = 0;

// ── Mining runs ──────────────────────────────────────────────────────────
// Seconds a hauler spends out on a run before it's eligible to return.
export const DURATION_MIN = 12;
export const DURATION_MAX = 48;

// Base ore yield range for a single run, before Prospecting Skill bonus.
export const ORE_YIELD_MIN = 70;
export const ORE_YIELD_MAX = 240;

// ── Refinery ─────────────────────────────────────────────────────────────
// Ore is raw cargo; the refinery converts it into spendable credits over
// time, at a fixed exchange rate, up to a throughput cap per second.
export const CREDITS_PER_ORE = 4;
export const CARGO_BASE_CAPACITY = 600;
export const CARGO_CAPACITY_PER_LEVEL = 300;
export const REFINERY_BASE_THROUGHPUT = 6; // ore/sec at level 1
export const REFINERY_THROUGHPUT_PER_LEVEL = 4;

// ── Costs ────────────────────────────────────────────────────────────────
export const HAULER_BASE_COST = 1200;
export const PROSPECTING_BASE_COST = 10000;
export const DRIVE_TUNING_BASE_COST = 10000;
export const REFINERY_CAPACITY_BASE_COST = 8000;
export const REFINERY_THROUGHPUT_BASE_COST = 12000;

// ── Progressive unlocks ──────────────────────────────────────────────────
// Deliberately not surfaced anywhere in the UI up front — systems reveal
// themselves as credits cross these thresholds, same "figure it out as you
// go" pacing as the game this one is inspired by.
export const ALLOW_REFINERY_CAPACITY = 3000;
export const ALLOW_FLOW_RATE = 5000;
export const ALLOW_PROSPECTING = 10000;
export const ALLOW_REFINERY_THROUGHPUT = 20000;
export const ALLOW_DRIVE_TUNING = 60000;
export const ALLOW_AUTOMINE = 400000;
export const ALLOW_10X_HAULER = 40; // fleet size
export const ALLOW_100X_HAULER = 90; // fleet size

// ── Timers (all in seconds) ─────────────────────────────────────────────
export const AUTOMINE_INTERVAL = 20;
export const NEWS_INTERVAL = 180;
export const FLOW_RATE_WINDOW = 10;
export const RANDOM_EVENT_MIN_DELAY = 240;
export const RANDOM_EVENT_JITTER = 180;
export const SAVE_INTERVAL = 10;

export const MAX_LOG_LINES = 150;

// Offline progress is estimated, not simulated tick-by-tick, and capped so
// leaving a tab closed for days doesn't turn into a free-money exploit.
export const MAX_OFFLINE_SECONDS = 8 * 60 * 60;

export const SAVE_KEY = "voidHarvestSave.v1";

// 10 tiers, keyed off the digit-length of fleet size (1-9, 10-99, ...),
// same technique the inspiration game used for its own rank system.
export const RANKS = [
	"Independent Prospector",
	"Claim Registrant",
	"Vein Runner",
	"Deep Driller",
	"Asteroid Foreman",
	"Void Contractor",
	"Sector Baron",
	"Mining Magnate",
	"Reach Sovereign",
	"Harvest Eternal"
];

// Temporary fleet-wide modifiers random events can apply. Duration in
// seconds; magnitude is a multiplier applied to the named stat.
export const TEMP_EVENTS = [
	{ key: "richVein", stat: "oreYield", magnitude: 1.5, durationSec: 180, kind: "good" },
	{ key: "solarFlare", stat: "refineryThroughput", magnitude: 0.6, durationSec: 120, kind: "bad" }
];

export const SHIP_NAME_ADJECTIVES = [
	"Rusty", "Silent", "Hollow", "Ember", "Frost", "Obsidian", "Drifting",
	"Forgotten", "Bold", "Weathered", "Restless", "Iron", "Crimson", "Dust-worn",
	"Lucky", "Stubborn", "Patched", "Wandering", "Grim", "Steadfast"
];

export const SHIP_NAME_NOUNS = [
	"Prospector", "Driller", "Harvester", "Wanderer", "Vagrant", "Excavator",
	"Nomad", "Scavenger", "Relic", "Comet", "Longhaul", "Claimjumper",
	"Tunneler", "Drifter", "Reclaimer", "Outrider", "Anchorage", "Pathfinder"
];
