"use strict";

// Converts server-rendered UTC timestamps into the viewer's own local
// timezone. This app's server (and everything it writes to the DB) runs in
// UTC — see RequestLogger.bx / ServerMonitor.bx — so every value this finds
// is an unambiguous UTC instant; formatting it is just Intl.DateTimeFormat,
// which defaults to the browser's own timezone when none is specified.
//
// Usage: <time datetime="2026-08-19T17:53:21Z" data-local-time
//         data-local-format="datetime">Aug 19, 1:53 PM UTC</time>
// The element's existing text is the server-rendered (UTC) fallback, shown
// until this runs — progressive enhancement, not a loading flash into
// empty content, and still correct if JS is unavailable.
//
// data-local-title-format + data-local-title-prefix optionally rewrite the
// element's title attribute the same way, for tooltips that state a time in
// prose (e.g. the scheduled-post badge's "Goes live <when>").
window.LocalTime = (function(){
	var PRESETS = {
		"date"             : { month: "short", day: "numeric", year: "numeric" },
		"month-day"        : { month: "short", day: "numeric" },
		"datetime"         : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
		"datetime-seconds" : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" },
		"time"             : { hour: "numeric", minute: "2-digit" }
	};

	function format(utcIso, presetName){
		var date = new Date(utcIso);
		if (isNaN(date.getTime())) return null;
		return new Intl.DateTimeFormat(undefined, PRESETS[presetName] || PRESETS.datetime).format(date);
	}

	function apply(scope){
		var elements = (scope || document).querySelectorAll("[data-local-time], [data-local-title-format]");
		Array.prototype.forEach.call(elements, function(el){
			var iso = el.getAttribute("datetime");
			if (!iso) return;

			if (el.hasAttribute("data-local-time")) {
				var textFormatted = format(iso, el.getAttribute("data-local-format"));
				if (textFormatted) el.textContent = textFormatted;
			}

			var titleFormatName = el.getAttribute("data-local-title-format");
			if (titleFormatName) {
				var titleFormatted = format(iso, titleFormatName);
				if (titleFormatted) el.title = (el.getAttribute("data-local-title-prefix") || "") + titleFormatted;
			}
		});
	}

	document.addEventListener("DOMContentLoaded", function(){ apply(); });

	return { format: format, apply: apply };
})();
