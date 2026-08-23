// Purely decorative — a slow twinkling starfield behind the glass panels.
// Deliberately not Alpine-driven; this never touches game state.
( function () {
	const canvas = document.getElementById( "starfield-canvas" );
	if ( !canvas ) return;
	const ctx = canvas.getContext( "2d" );
	let stars = [];

	function resize() {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
		const count = Math.floor( ( canvas.width * canvas.height ) / 9000 );
		stars = Array.from( { length: count }, () => ( {
			x: Math.random() * canvas.width,
			y: Math.random() * canvas.height,
			r: Math.random() * 1.2 + 0.2,
			phase: Math.random() * Math.PI * 2,
			speed: Math.random() * 0.015 + 0.005
		} ) );
	}

	function frame( t ) {
		ctx.clearRect( 0, 0, canvas.width, canvas.height );
		for ( const star of stars ) {
			const twinkle = 0.5 + 0.5 * Math.sin( t * star.speed + star.phase );
			ctx.globalAlpha = 0.25 + twinkle * 0.6;
			ctx.fillStyle = "#cdd3ff";
			ctx.beginPath();
			ctx.arc( star.x, star.y, star.r, 0, Math.PI * 2 );
			ctx.fill();
		}
		requestAnimationFrame( frame );
	}

	window.addEventListener( "resize", resize );
	resize();
	requestAnimationFrame( frame );
} )();
