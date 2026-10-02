export interface ScrollSide {
	el: HTMLElement;
	/** Scroll offsets of this side's headings, in document order. */
	headings: () => number[];
}

// Scroll positions that mean the same place on both sides: the top, each
// heading, and the bottom. Between two of them the panes move in proportion,
// so an image or a code block that is far taller on one side only skews the
// section it's in, not everything below it. If the two sides disagree on how
// many headings there are, only the top and bottom are used.
function anchors(side: ScrollSide, headings: number[], usable: boolean): number[] {
	const max = Math.max(side.el.scrollHeight - side.el.clientHeight, 0);
	const points = [0];
	if (usable) {
		for (const offset of headings) {
			points.push(Math.min(Math.max(offset, points[points.length - 1]!), max));
		}
	}
	points.push(max);
	return points;
}

function mapped(position: number, from: number[], to: number[]): number {
	let i = 0;
	while (i < from.length - 2 && position >= from[i + 1]!) i++;
	const span = from[i + 1]! - from[i]!;
	const ratio = span > 0 ? Math.min((position - from[i]!) / span, 1) : 0;
	return to[i]! + ratio * (to[i + 1]! - to[i]!);
}

/**
 * Keeps two scrolling panes at the same place in the text. Returns a function
 * that unlinks them, with `sync` on it to line the second up with the first
 * again after its content changes.
 */
export function linkScroll(first: ScrollSide, second: ScrollSide) {
	// The pane being moved by this code, so its own scroll event isn't taken
	// for the reader scrolling it and sent back the other way.
	let moving: HTMLElement | null = null;

	const follow = (leader: ScrollSide, follower: ScrollSide) => {
		const leaderHeadings = leader.headings();
		const followerHeadings = follower.headings();
		const usable = leaderHeadings.length === followerHeadings.length;
		const target = mapped(
			leader.el.scrollTop,
			anchors(leader, leaderHeadings, usable),
			anchors(follower, followerHeadings, usable),
		);
		if (Math.abs(follower.el.scrollTop - target) < 1) return;
		const el = follower.el;
		moving = el;
		el.scrollTop = target;
		// If the browser clamps that to where the pane already was, no scroll
		// event follows to release it.
		window.setTimeout(() => {
			if (moving === el) moving = null;
		}, 100);
	};

	const listener = (leader: ScrollSide, follower: ScrollSide) => () => {
		if (moving === leader.el) {
			moving = null;
			return;
		}
		follow(leader, follower);
	};

	const onFirst = listener(first, second);
	const onSecond = listener(second, first);
	first.el.addEventListener("scroll", onFirst, { passive: true });
	second.el.addEventListener("scroll", onSecond, { passive: true });

	const unlink = () => {
		first.el.removeEventListener("scroll", onFirst);
		second.el.removeEventListener("scroll", onSecond);
	};
	unlink.sync = () => follow(first, second);
	return unlink;
}

export function headingOffsetsIn(container: HTMLElement): number[] {
	const top = container.getBoundingClientRect().top - container.scrollTop;
	return Array.from(container.querySelectorAll("h1, h2, h3, h4, h5, h6"), (heading) => heading.getBoundingClientRect().top - top);
}
