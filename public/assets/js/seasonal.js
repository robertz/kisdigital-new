// Snow (winter) or falling leaves (autumn) behind the home page. The server
// only renders the canvas in season; see models/util/Season.bx.
(function () {
	var canvas = document.getElementById("seasonal-canvas");
	var toggle = document.getElementById("seasonal-toggle");
	if (!canvas || !canvas.getContext) return;

	var STORAGE_KEY = "seasonalEffect";
	var season = canvas.getAttribute("data-season") === "autumn" ? "autumn" : "winter";
	var ctx = canvas.getContext("2d");
	var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
	var darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

	var width = 0;
	var height = 0;
	var particles = [];
	var frame = 0;
	var last = 0;
	var enabled = readEnabled();

	var LEAF_COLOURS = ["#c8742f", "#a8461f", "#d4a03a", "#8c5a2b", "#b8632a"];

	function readEnabled() {
		try {
			return localStorage.getItem(STORAGE_KEY) !== "off";
		} catch (e) {
			return true;
		}
	}

	function isDark() {
		var theme = document.documentElement.getAttribute("data-theme");
		if (theme === "dark") return true;
		if (theme === "light") return false;
		return darkQuery.matches;
	}

	function snowColour() {
		return isDark() ? "rgba(255, 255, 255, 0.6)" : "rgba(150, 170, 195, 0.55)";
	}

	function count() {
		var base = season === "autumn" ? 18 : 55;
		return width < 768 ? Math.round(base * 0.5) : base;
	}

	function rand(min, max) {
		return min + Math.random() * (max - min);
	}

	function spawn(anywhere) {
		var y = anywhere ? rand(0, height) : rand(-40, -10);
		if (season === "autumn") {
			return {
				x: rand(0, width), y: y,
				size: rand(7, 13),
				speed: rand(18, 34),
				sway: rand(14, 30),
				phase: rand(0, Math.PI * 2),
				spin: rand(-0.9, 0.9),
				angle: rand(0, Math.PI * 2),
				colour: LEAF_COLOURS[Math.floor(Math.random() * LEAF_COLOURS.length)],
				alpha: rand(0.45, 0.75)
			};
		}
		return {
			x: rand(0, width), y: y,
			size: rand(1, 3),
			speed: rand(14, 38),
			sway: rand(6, 18),
			phase: rand(0, Math.PI * 2)
		};
	}

	function resize() {
		var ratio = window.devicePixelRatio || 1;
		width = window.innerWidth;
		height = window.innerHeight;
		canvas.width = Math.round(width * ratio);
		canvas.height = Math.round(height * ratio);
		ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

		var target = count();
		while (particles.length < target) particles.push(spawn(true));
		particles.length = target;
		if (!frame) draw();
	}

	function drawLeaf(p) {
		ctx.save();
		ctx.translate(p.x, p.y);
		ctx.rotate(p.angle);
		ctx.globalAlpha = p.alpha;
		ctx.fillStyle = p.colour;
		ctx.beginPath();
		ctx.moveTo(0, -p.size);
		ctx.quadraticCurveTo(p.size * 0.75, 0, 0, p.size);
		ctx.quadraticCurveTo(-p.size * 0.75, 0, 0, -p.size);
		ctx.fill();
		ctx.globalAlpha = p.alpha * 0.6;
		ctx.strokeStyle = p.colour;
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(0, -p.size);
		ctx.lineTo(0, p.size * 1.3);
		ctx.stroke();
		ctx.restore();
	}

	function draw() {
		ctx.clearRect(0, 0, width, height);
		if (season === "autumn") {
			particles.forEach(drawLeaf);
			return;
		}
		ctx.fillStyle = snowColour();
		ctx.beginPath();
		particles.forEach(function (p) {
			ctx.moveTo(p.x + p.size, p.y);
			ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
		});
		ctx.fill();
	}

	function step(time) {
		var dt = last ? Math.min((time - last) / 1000, 0.05) : 0;
		last = time;

		for (var i = 0; i < particles.length; i++) {
			var p = particles[i];
			p.phase += dt * 0.9;
			p.y += p.speed * dt;
			p.x += Math.sin(p.phase) * p.sway * dt;
			if (p.angle !== undefined) p.angle += p.spin * dt;
			if (p.y > height + 20 || p.x < -30 || p.x > width + 30) particles[i] = spawn(false);
		}

		draw();
		frame = requestAnimationFrame(step);
	}

	function start() {
		if (frame || !enabled || reducedMotion.matches || document.hidden) return;
		last = 0;
		frame = requestAnimationFrame(step);
	}

	function stop() {
		if (frame) cancelAnimationFrame(frame);
		frame = 0;
	}

	function apply() {
		canvas.hidden = !enabled;
		if (toggle) {
			toggle.setAttribute("aria-pressed", enabled ? "true" : "false");
			toggle.textContent = (season === "autumn" ? "Leaves " : "Snow ") + (enabled ? "off" : "on");
		}
		if (enabled) {
			draw();
			start();
		} else {
			stop();
		}
	}

	if (toggle) {
		toggle.hidden = false;
		toggle.addEventListener("click", function () {
			enabled = !enabled;
			try {
				localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
			} catch (e) {}
			apply();
		});
	}

	document.addEventListener("visibilitychange", function () {
		if (document.hidden) stop(); else start();
	});
	reducedMotion.addEventListener("change", function () {
		if (reducedMotion.matches) stop(); else start();
	});
	new MutationObserver(function () {
		if (!frame) draw();
	}).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
	window.addEventListener("resize", resize);

	resize();
	apply();
})();
