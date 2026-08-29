// Pixel Canvas — a live, shared 48x48 grid. Talks to two boxlang-express
// routes (routes/PixelCanvas.bx): GET .../stream opens an SSE connection
// that first sends the whole grid as one "init" event, then a "pixel"
// event for every placement anyone makes from then on; POST .../place
// submits this tab's own placement, which comes back over the same
// stream a moment later along with everyone else's.
//
// PALETTE positions are the color indexes the server stores and broadcasts
// — must stay in the same order as routes/PixelCanvas.bx expects (0-15).
const PALETTE = [
	"#FFFFFF", "#D4D7D9", "#898D90", "#000000",
	"#FFA7D1", "#FF4500", "#FFA800", "#9C6926",
	"#FFD635", "#7EED56", "#00A368", "#00CCC0",
	"#51E9F4", "#3690EA", "#493AC1", "#811E9F"
];

const COOLDOWN_MS = 3000;

let gridSize = 48;
let grid = [];
let selectedColor = 5;
let cooldownUntil = 0;
let csrfToken = null;

const canvas = document.getElementById( "board" );
const ctx = canvas.getContext( "2d" );
const statusEl = document.getElementById( "status" );
const paletteEl = document.getElementById( "palette" );

function hexToRgb( hex ) {
	return [
		parseInt( hex.slice( 1, 3 ), 16 ),
		parseInt( hex.slice( 3, 5 ), 16 ),
		parseInt( hex.slice( 5, 7 ), 16 )
	];
}

function buildPalette() {
	PALETTE.forEach( ( hex, idx ) => {
		const btn = document.createElement( "button" );
		btn.type = "button";
		btn.className = "pc-swatch" + ( idx === selectedColor ? " is-selected" : "" );
		btn.style.background = hex;
		btn.setAttribute( "aria-label", "Select color " + idx );
		btn.addEventListener( "click", () => {
			selectedColor = idx;
			[ ...paletteEl.children ].forEach( ( child, i ) => child.classList.toggle( "is-selected", i === idx ) );
		} );
		paletteEl.appendChild( btn );
	} );
}

function drawAll() {
	canvas.width = gridSize;
	canvas.height = gridSize;
	const imgData = ctx.createImageData( gridSize, gridSize );
	for ( let i = 0; i < grid.length; i++ ) {
		const [ r, g, b ] = hexToRgb( PALETTE[ grid[ i ] ] ?? "#FFFFFF" );
		imgData.data[ i * 4 ] = r;
		imgData.data[ i * 4 + 1 ] = g;
		imgData.data[ i * 4 + 2 ] = b;
		imgData.data[ i * 4 + 3 ] = 255;
	}
	ctx.putImageData( imgData, 0, 0 );
}

function drawPixel( i, colorIdx ) {
	grid[ i ] = colorIdx;
	const x = i % gridSize;
	const y = Math.floor( i / gridSize );
	ctx.fillStyle = PALETTE[ colorIdx ] ?? "#FFFFFF";
	ctx.fillRect( x, y, 1, 1 );
}

function connect() {
	const es = new EventSource( "/games/pixel-canvas/stream" );

	es.addEventListener( "init", ( e ) => {
		const data = JSON.parse( e.data );
		gridSize = data.gridSize;
		grid = data.grid;
		drawAll();
		statusEl.textContent = "live";
		statusEl.dataset.state = "live";
	} );

	es.addEventListener( "pixel", ( e ) => {
		const data = JSON.parse( e.data );
		drawPixel( data.i, data.color );
	} );

	es.onerror = () => {
		statusEl.textContent = "reconnecting…";
		statusEl.dataset.state = "error";
	};
}

canvas.addEventListener( "click", async ( ev ) => {
	if ( Date.now() < cooldownUntil ) return;

	const rect = canvas.getBoundingClientRect();
	const x = Math.floor( ( ev.clientX - rect.left ) / rect.width * gridSize );
	const y = Math.floor( ( ev.clientY - rect.top ) / rect.height * gridSize );
	const i = y * gridSize + x;

	cooldownUntil = Date.now() + COOLDOWN_MS;
	canvas.classList.add( "is-cooldown" );
	setTimeout( () => canvas.classList.remove( "is-cooldown" ), COOLDOWN_MS );

	try {
		const res = await fetch( "/games/pixel-canvas/place", {
			method: "POST",
			headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken ?? "" },
			body: JSON.stringify( { i, color: selectedColor } )
		} );
		if ( !res.ok ) {
			const body = await res.json().catch( () => ( {} ) );
			statusEl.textContent = body.message || body.error || "couldn't place pixel";
		}
	} catch ( err ) {
		statusEl.textContent = "connection issue";
	}
} );

async function fetchCsrfToken() {
	try {
		const res = await fetch( "/games/pixel-canvas/token" );
		const data = await res.json();
		csrfToken = data.csrfToken;
	} catch ( err ) {
		// Placement will fail with a clear message if this never resolves —
		// no need to block the rest of the page on it.
	}
}

buildPalette();
connect();
fetchCsrfToken();
