import * as C from "./constants.js";

document.addEventListener("alpine:init", () => {
	Alpine.data("app", () => ({
		// ── Core resources ───────────────────────────────────────────────
		credits: C.INITIAL_CREDITS,
		ore: C.INITIAL_ORE,
		ships: [],
		log: [],

		// ── Upgrades (levels start at 1 = not-yet-purchased baseline) ────
		prospectingSkill: 1,
		driveTuning: 1,
		refineryCapacityLevel: 1,
		refineryThroughputLevel: 1,
		autoMine: false,

		// ── Progressive-unlock flags (flip once, then stay flipped) ──────
		prospectingFlipped: false,
		driveTuningFlipped: false,
		refineryCapacityFlipped: false,
		refineryThroughputFlipped: false,
		autoMineFlipped: false,
		flowRateFlipped: false,

		// ── Live/derived display state ───────────────────────────────────
		flowRate: null,
		lastFlowCredits: C.INITIAL_CREDITS,
		nextHaulerReturnIn: null,
		clockTick: 0,
		activeEffects: [], // { key, stat, magnitude, expiresAt, label }

		// ── Housekeeping ─────────────────────────────────────────────────
		messages: null,
		welcomeBack: null, // set on load if there was meaningful offline progress
		showSettings: false,
		exportText: "",
		importText: "",
		importError: "",

		async init() {
			this.messages = await ( await fetch( "./js/messages.json" ) ).json();

			if ( !this.load() ) {
				this.addHauler();
			}

			setInterval( () => this.heartbeat(), 1000 );
			setInterval( () => this.tickFlowRate(), C.FLOW_RATE_WINDOW * 1000 );
			setInterval( () => this.doAutoMine(), C.AUTOMINE_INTERVAL * 1000 );
			setInterval( () => this.randomNews(), C.NEWS_INTERVAL * 1000 );
			setInterval( () => this.save(), C.SAVE_INTERVAL * 1000 );
			window.addEventListener( "beforeunload", () => this.save() );

			this.scheduleRandomEvent();
		},

		// ── Main loop ────────────────────────────────────────────────────
		heartbeat() {
			this.clockTick++;

			const now = Date.now();
			let soonest = null;

			for ( const ship of this.ships ) {
				if ( ship.available ) continue;

				if ( now >= ship.returnTime ) {
					this.resolveHauler( ship );
				} else if ( soonest === null || ship.returnTime < soonest ) {
					soonest = ship.returnTime;
				}
			}

			this.nextHaulerReturnIn = soonest === null ? null : this.formatDuration( Math.max( 0, Math.round( ( soonest - now ) / 1000 ) ) );

			this.tickRefinery( 1 );
			this.pruneExpiredEffects();
		},

		tickRefinery( seconds ) {
			if ( this.ore <= 0 ) return;
			const processed = Math.min( this.ore, this.currentThroughput * seconds );
			this.ore -= processed;
			this.credits += processed * C.CREDITS_PER_ORE;
		},

		tickFlowRate() {
			const change = this.credits - this.lastFlowCredits;
			this.flowRate = Math.floor( change / C.FLOW_RATE_WINDOW );
			this.lastFlowCredits = this.credits;
		},

		// ── Haulers ──────────────────────────────────────────────────────
		addHauler() {
			const ship = {
				id: crypto.randomUUID(),
				name: this.generateHaulerName(),
				available: true,
				departedAt: null,
				returnTime: null,
				tripDuration: null
			};
			this.ships.push( ship );
			this.addLog( `${ ship.name } joins the fleet.` );
			return ship;
		},

		launchHauler( ship ) {
			if ( !ship.available ) return;

			let duration = this.getRandomInt( C.DURATION_MIN, C.DURATION_MAX );
			if ( this.driveTuning >= 2 ) {
				const savingsPercent = Math.min( this.getRandomInt( 1, this.driveTuning ), 90 );
				duration -= Math.floor( duration * ( savingsPercent / 100 ) );
			}
			duration = Math.max( duration, 3 );

			ship.available = false;
			ship.departedAt = Date.now();
			ship.tripDuration = duration;
			ship.returnTime = ship.departedAt + duration * 1000;

			this.addLog( `${ ship.name } departs for the belt...` );
		},

		resolveHauler( ship ) {
			ship.available = true;
			ship.departedAt = null;
			ship.returnTime = null;
			ship.tripDuration = null;

			const bonus = 1 + ( this.prospectingSkill - 1 ) * 0.15;
			const tempMultiplier = this.effectMultiplier( "oreYield" );
			const yielded = Math.floor( this.getRandomInt( C.ORE_YIELD_MIN, C.ORE_YIELD_MAX ) * bonus * tempMultiplier );

			const room = this.cargoCapacity - this.ore;
			const accepted = Math.max( 0, Math.min( yielded, room ) );
			const overflow = yielded - accepted;
			this.ore += accepted;

			if ( overflow > 0 ) {
				this.addLog( `${ ship.name } returns with ${ this.numberFormat( yielded ) } ore, but the cargo bay is full — <strong class="bad">${ this.numberFormat( overflow ) } ore vented to space.</strong>` );
			} else {
				this.addLog( `${ ship.name } returns and offloads ${ this.numberFormat( yielded ) } ore.` );
			}
		},

		launchAllAvailable() {
			for ( const ship of this.availableHaulers ) {
				this.launchHauler( ship );
			}
		},

		doAutoMine() {
			if ( this.autoMine ) this.launchAllAvailable();
		},

		buyHauler( count ) {
			for ( let i = 0; i < count; i++ ) {
				if ( !this.canBuyHauler ) return;
				this.credits -= this.haulerCost( this.ships.length + 1 );
				this.addHauler();
			}
		},

		// ── Upgrades ─────────────────────────────────────────────────────
		buyProspecting() {
			if ( !this.canBuyProspecting ) return;
			this.credits -= this.prospectingCost;
			this.prospectingSkill++;
		},

		buyDriveTuning() {
			if ( !this.canBuyDriveTuning ) return;
			this.credits -= this.driveTuningCost;
			this.driveTuning++;
		},

		buyRefineryCapacity() {
			if ( !this.canBuyRefineryCapacity ) return;
			this.credits -= this.refineryCapacityCost;
			this.refineryCapacityLevel++;
		},

		buyRefineryThroughput() {
			if ( !this.canBuyRefineryThroughput ) return;
			this.credits -= this.refineryThroughputCost;
			this.refineryThroughputLevel++;
		},

		toggleAutoMine() {
			this.autoMine = !this.autoMine;
		},

		// ── Temporary fleet-wide effects ─────────────────────────────────
		applyRandomTempEvent() {
			const def = C.TEMP_EVENTS[ this.getRandomInt( 0, C.TEMP_EVENTS.length ) ];
			const pool = this.messages[ def.key ] ?? [];
			const text = pool.length ? pool[ this.getRandomInt( 0, pool.length ) ] : "Something shifts in the deep dark.";

			this.activeEffects = this.activeEffects.filter( e => e.key !== def.key );
			this.activeEffects.push( {
				key: def.key,
				stat: def.stat,
				magnitude: def.magnitude,
				expiresAt: Date.now() + def.durationSec * 1000,
				label: def.kind === "good"
					? `${ def.stat === "oreYield" ? "Rich Vein" : "Boosted" } (+${ Math.round( ( def.magnitude - 1 ) * 100 ) }%)`
					: `${ def.stat === "refineryThroughput" ? "Solar Flare" : "Hindered" } (${ Math.round( ( def.magnitude - 1 ) * 100 ) }%)`
			} );

			const cls = def.kind === "good" ? "good" : "bad";
			this.addLog( `<strong class="${ cls }">${ text }</strong>` );
		},

		pruneExpiredEffects() {
			if ( !this.activeEffects.length ) return;
			const now = Date.now();
			this.activeEffects = this.activeEffects.filter( e => e.expiresAt > now );
		},

		effectMultiplier( stat ) {
			let multiplier = 1;
			for ( const effect of this.activeEffects ) {
				if ( effect.stat === stat ) multiplier *= effect.magnitude;
			}
			return multiplier;
		},

		// ── Random events & flavor text ──────────────────────────────────
		scheduleRandomEvent() {
			const delay = ( C.RANDOM_EVENT_MIN_DELAY + this.getRandomInt( 0, C.RANDOM_EVENT_JITTER ) ) * 1000;
			setTimeout( () => this.randomEvent(), delay );
		},

		randomEvent() {
			const roll = this.getRandomInt( 0, 100 );

			if ( roll < 32 ) {
				const won = Math.floor( this.credits * ( this.getRandomInt( 10, 70 ) / 100 ) );
				const msg = this.messages.moneyWon[ this.getRandomInt( 0, this.messages.moneyWon.length ) ];
				this.credits += won;
				this.addLog( `<strong class="good">${ msg } Gain ${ this.numberFormat( won ) } credits!</strong>` );
			} else if ( roll < 64 ) {
				if ( this.credits >= 500 ) {
					const lost = Math.floor( this.credits * ( this.getRandomInt( 5, 30 ) / 100 ) );
					const msg = this.messages.moneyLost[ this.getRandomInt( 0, this.messages.moneyLost.length ) ];
					this.credits -= lost;
					this.addLog( `<strong class="bad">${ msg } Lose ${ this.numberFormat( lost ) } credits.</strong>` );
				}
			} else if ( roll < 80 ) {
				const msg = this.messages.shipWon[ this.getRandomInt( 0, this.messages.shipWon.length ) ];
				this.addLog( `<strong class="good">${ msg }</strong>` );
				this.addHauler();
			} else if ( roll < 91 ) {
				if ( this.ships.length > 10 ) {
					const msg = this.messages.shipLost[ this.getRandomInt( 0, this.messages.shipLost.length ) ];
					this.addLog( `<strong class="bad">${ msg }</strong>` );
					this.ships.splice( this.getRandomInt( 0, this.ships.length ), 1 );
				}
			} else {
				this.applyRandomTempEvent();
			}

			this.scheduleRandomEvent();
		},

		randomNews() {
			const msg = this.messages.news[ this.getRandomInt( 0, this.messages.news.length ) ];
			this.addLog( msg );
		},

		addLog( html ) {
			this.log.push( { id: crypto.randomUUID(), html, at: Date.now() } );
			if ( this.log.length > C.MAX_LOG_LINES ) this.log.shift();
			this.$nextTick( () => {
				if ( this.$refs.logPanel ) this.$refs.logPanel.scrollTop = this.$refs.logPanel.scrollHeight;
			} );
		},

		generateHaulerName() {
			const adjective = C.SHIP_NAME_ADJECTIVES[ this.getRandomInt( 0, C.SHIP_NAME_ADJECTIVES.length ) ];
			const noun = C.SHIP_NAME_NOUNS[ this.getRandomInt( 0, C.SHIP_NAME_NOUNS.length ) ];
			return `${ adjective } ${ noun }`;
		},

		// ── Persistence ──────────────────────────────────────────────────
		save() {
			const payload = {
				v: 1,
				savedAt: Date.now(),
				credits: this.credits,
				ore: this.ore,
				ships: this.ships,
				prospectingSkill: this.prospectingSkill,
				driveTuning: this.driveTuning,
				refineryCapacityLevel: this.refineryCapacityLevel,
				refineryThroughputLevel: this.refineryThroughputLevel,
				autoMine: this.autoMine,
				prospectingFlipped: this.prospectingFlipped,
				driveTuningFlipped: this.driveTuningFlipped,
				refineryCapacityFlipped: this.refineryCapacityFlipped,
				refineryThroughputFlipped: this.refineryThroughputFlipped,
				autoMineFlipped: this.autoMineFlipped,
				flowRateFlipped: this.flowRateFlipped
			};
			localStorage.setItem( C.SAVE_KEY, JSON.stringify( payload ) );
		},

		load() {
			const raw = localStorage.getItem( C.SAVE_KEY );
			if ( !raw ) return false;

			let data;
			try {
				data = JSON.parse( raw );
			} catch ( e ) {
				return false;
			}

			this.credits = data.credits ?? C.INITIAL_CREDITS;
			this.ore = data.ore ?? C.INITIAL_ORE;
			this.ships = data.ships ?? [];
			this.prospectingSkill = data.prospectingSkill ?? 1;
			this.driveTuning = data.driveTuning ?? 1;
			this.refineryCapacityLevel = data.refineryCapacityLevel ?? 1;
			this.refineryThroughputLevel = data.refineryThroughputLevel ?? 1;
			this.autoMine = data.autoMine ?? false;
			this.prospectingFlipped = data.prospectingFlipped ?? false;
			this.driveTuningFlipped = data.driveTuningFlipped ?? false;
			this.refineryCapacityFlipped = data.refineryCapacityFlipped ?? false;
			this.refineryThroughputFlipped = data.refineryThroughputFlipped ?? false;
			this.autoMineFlipped = data.autoMineFlipped ?? false;
			this.flowRateFlipped = data.flowRateFlipped ?? false;
			this.lastFlowCredits = this.credits;

			if ( !this.ships.length ) this.addHauler();

			this.applyOfflineProgress( data.savedAt ?? Date.now() );
			return true;
		},

		applyOfflineProgress( savedAt ) {
			const elapsedSeconds = Math.floor( ( Date.now() - savedAt ) / 1000 );
			if ( elapsedSeconds < 5 ) return;

			const cappedSeconds = Math.min( elapsedSeconds, C.MAX_OFFLINE_SECONDS );

			// Snapshot who was docked *before* resolving in-flight haulers below —
			// a hauler that was out on a run gets credit for that one run only,
			// not also folded into the auto-mine estimate for the same window.
			const idleHaulersAtSave = this.ships.filter( s => s.available ).length;

			let haulersReturned = 0;
			let oreFromReturns = 0;

			// Haulers already out when the tab closed: resolve them normally,
			// using today's stats, exactly like a heartbeat tick would.
			for ( const ship of this.ships ) {
				if ( !ship.available && ship.returnTime && ship.returnTime <= Date.now() ) {
					const before = this.ore;
					this.resolveHauler( ship );
					oreFromReturns += this.ore - before;
					haulersReturned++;
				}
			}

			// Haulers that were docked (before the above) with auto-mine on:
			// estimate additional runs across the offline window rather than
			// simulating each one — exact per-trip simulation isn't worth it
			// for a background tab.
			let oreFromAutoMine = 0;
			if ( this.autoMine && idleHaulersAtSave > 0 ) {
				const avgDuration = ( C.DURATION_MIN + C.DURATION_MAX ) / 2;
				const avgYield = ( C.ORE_YIELD_MIN + C.ORE_YIELD_MAX ) / 2 * ( 1 + ( this.prospectingSkill - 1 ) * 0.15 );
				const tripsPerHauler = Math.floor( cappedSeconds / avgDuration );
				oreFromAutoMine = Math.floor( idleHaulersAtSave * tripsPerHauler * avgYield );
			}

			// Cargo hold is just as finite offline as it is live — cap what
			// actually lands in the hold and track what didn't fit, same as a
			// normal hauler return does.
			const room = Math.max( 0, this.cargoCapacity - this.ore );
			const oreAccepted = Math.min( oreFromAutoMine, room );
			const oreVented = oreFromAutoMine - oreAccepted;
			this.ore += oreAccepted;

			const oreBeforeRefine = this.ore;
			this.tickRefinery( cappedSeconds );
			const creditsGained = Math.round( ( oreBeforeRefine - this.ore ) * C.CREDITS_PER_ORE );

			if ( haulersReturned > 0 || oreAccepted > 0 || creditsGained > 0 ) {
				const intro = this.messages.welcomeBack[ this.getRandomInt( 0, this.messages.welcomeBack.length ) ];
				this.welcomeBack = {
					away: this.formatDuration( elapsedSeconds ),
					capped: elapsedSeconds > C.MAX_OFFLINE_SECONDS,
					haulersReturned,
					oreGained: oreFromReturns + oreAccepted,
					oreVented,
					creditsGained,
					intro
				};
			}
		},

		dismissWelcomeBack() {
			this.welcomeBack = null;
		},

		openSettings() {
			this.save();
			this.exportText = localStorage.getItem( C.SAVE_KEY ) ?? "";
			this.importText = "";
			this.importError = "";
			this.showSettings = true;
		},

		closeSettings() {
			this.showSettings = false;
		},

		submitImport() {
			try {
				JSON.parse( this.importText );
			} catch ( e ) {
				this.importError = "That doesn't look like a valid save file.";
				return;
			}
			localStorage.setItem( C.SAVE_KEY, this.importText );
			window.location.reload();
		},

		resetGame() {
			localStorage.removeItem( C.SAVE_KEY );
			window.location.reload();
		},

		// ── Getters: fleet ───────────────────────────────────────────────
		get availableHaulers() {
			return this.ships.filter( s => s.available );
		},

		get fleetSize() {
			return this.ships.length;
		},

		get haulersAvailable() {
			return this.availableHaulers.length > 0;
		},

		get numAvailableHaulers() {
			return this.availableHaulers.length;
		},

		get rank() {
			const pos = this.ships.length.toString().length - 1;
			return C.RANKS[ Math.min( pos, C.RANKS.length - 1 ) ];
		},

		haulerCost( atFleetSize ) {
			return C.HAULER_BASE_COST * atFleetSize;
		},

		get newHaulerCost() {
			return this.haulerCost( this.ships.length + 1 );
		},

		get new10HaulerCost() {
			let cost = 0;
			for ( let i = 0; i < 10; i++ ) cost += this.haulerCost( this.ships.length + 1 + i );
			return cost;
		},

		get new100HaulerCost() {
			let cost = 0;
			for ( let i = 0; i < 100; i++ ) cost += this.haulerCost( this.ships.length + 1 + i );
			return cost;
		},

		get canBuyHauler() {
			return this.credits >= this.newHaulerCost;
		},

		get canBuy10Hauler() {
			return this.credits >= this.new10HaulerCost;
		},

		get canBuy100Hauler() {
			return this.credits >= this.new100HaulerCost;
		},

		get buy10Allowed() {
			return this.ships.length >= C.ALLOW_10X_HAULER;
		},

		get buy100Allowed() {
			return this.ships.length >= C.ALLOW_100X_HAULER;
		},

		// ── Getters: refinery/cargo ────────────────────────────────────────
		get cargoCapacity() {
			return C.CARGO_BASE_CAPACITY + ( this.refineryCapacityLevel - 1 ) * C.CARGO_CAPACITY_PER_LEVEL;
		},

		get cargoPercent() {
			return this.cargoCapacity > 0 ? Math.min( 100, Math.round( ( this.ore / this.cargoCapacity ) * 100 ) ) : 0;
		},

		get currentThroughput() {
			const base = C.REFINERY_BASE_THROUGHPUT + ( this.refineryThroughputLevel - 1 ) * C.REFINERY_THROUGHPUT_PER_LEVEL;
			return base * this.effectMultiplier( "refineryThroughput" );
		},

		// ── Getters: upgrades (cost + unlock + affordability) ─────────────
		get prospectingCost() {
			return C.PROSPECTING_BASE_COST * this.prospectingSkill;
		},

		get canBuyProspecting() {
			return this.credits >= this.prospectingCost;
		},

		get prospectingAllowed() {
			if ( this.credits >= C.ALLOW_PROSPECTING ) this.prospectingFlipped = true;
			return this.prospectingFlipped;
		},

		get driveTuningCost() {
			return C.DRIVE_TUNING_BASE_COST * this.driveTuning;
		},

		get canBuyDriveTuning() {
			return this.credits >= this.driveTuningCost;
		},

		get driveTuningAllowed() {
			if ( this.credits >= C.ALLOW_DRIVE_TUNING ) this.driveTuningFlipped = true;
			return this.driveTuningFlipped;
		},

		get refineryCapacityCost() {
			return C.REFINERY_CAPACITY_BASE_COST * this.refineryCapacityLevel;
		},

		get canBuyRefineryCapacity() {
			return this.credits >= this.refineryCapacityCost;
		},

		get refineryCapacityAllowed() {
			if ( this.credits >= C.ALLOW_REFINERY_CAPACITY ) this.refineryCapacityFlipped = true;
			return this.refineryCapacityFlipped;
		},

		get refineryThroughputCost() {
			return C.REFINERY_THROUGHPUT_BASE_COST * this.refineryThroughputLevel;
		},

		get canBuyRefineryThroughput() {
			return this.credits >= this.refineryThroughputCost;
		},

		get refineryThroughputAllowed() {
			if ( this.credits >= C.ALLOW_REFINERY_THROUGHPUT ) this.refineryThroughputFlipped = true;
			return this.refineryThroughputFlipped;
		},

		get autoMineAllowed() {
			if ( this.credits >= C.ALLOW_AUTOMINE ) this.autoMineFlipped = true;
			return this.autoMineFlipped;
		},

		get flowRateAllowed() {
			if ( this.credits >= C.ALLOW_FLOW_RATE ) this.flowRateFlipped = true;
			return this.flowRateFlipped;
		},

		get cheatsEnabled() {
			return new URLSearchParams( window.location.search ).has( "xyzzy" );
		},

		// ── Per-hauler UI helpers ──────────────────────────────────────────
		haulerProgressPercent( ship ) {
			void this.clockTick; // reactivity dependency — see heartbeat()
			if ( ship.available || !ship.departedAt || !ship.tripDuration ) return 0;
			const elapsed = ( Date.now() - ship.departedAt ) / 1000;
			return Math.max( 0, Math.min( 100, Math.round( ( elapsed / ship.tripDuration ) * 100 ) ) );
		},

		haulerRemainingLabel( ship ) {
			void this.clockTick;
			if ( ship.available || !ship.returnTime ) return "";
			return this.formatDuration( Math.max( 0, Math.round( ( ship.returnTime - Date.now() ) / 1000 ) ) );
		},

		// ── Formatting utils ─────────────────────────────────────────────
		numberFormat( n ) {
			const value = Math.floor( n );
			if ( !window.Intl ) return String( value );
			if ( Math.abs( value ) < 100000 ) return new Intl.NumberFormat().format( value );
			return new Intl.NumberFormat( undefined, { notation: "compact", maximumFractionDigits: 2 } ).format( value );
		},

		formatDuration( totalSeconds ) {
			const s = Math.max( 0, Math.floor( totalSeconds ) );
			const hours = Math.floor( s / 3600 );
			const minutes = Math.floor( ( s % 3600 ) / 60 );
			const seconds = s % 60;

			if ( hours > 0 ) return `${ hours }h ${ minutes }m`;
			if ( minutes > 0 ) return `${ minutes }m ${ seconds }s`;
			return `${ seconds }s`;
		},

		get logEntries() {
			return this.log;
		},

		getRandomInt( min, max ) {
			min = Math.ceil( min );
			max = Math.floor( max );
			return Math.floor( Math.random() * ( max - min ) + min ); // max exclusive
		}
	} ) );
} );
