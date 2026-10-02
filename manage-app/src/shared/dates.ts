// Publish dates travel as the server's own wall-clock time ("2026-10-02T14:30",
// the same value a datetime-local input holds), so they're shown as written
// rather than shifted into the browser's timezone.
function parseWallClock(value: string): Date | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value);
	if (!match) return null;
	return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4] ?? 0), Number(match[5] ?? 0));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatLocalDate(value: string): string {
	const date = parseWallClock(value);
	return date ? `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}` : "—";
}

export function formatLocalDateTime(value: string): string {
	const date = parseWallClock(value);
	if (!date) return "";
	const day = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
	const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
	return `${day} at ${time}`;
}

export function formatMonthDay(utcIso: string): string {
	const date = new Date(utcIso);
	return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatDateTime(utcIso: string, withSeconds = false): string {
	const date = new Date(utcIso);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		year: withSeconds ? undefined : "numeric",
		hour: "numeric",
		minute: "2-digit",
		second: withSeconds ? "2-digit" : undefined,
	});
}

export function formatDate(utcIso: string): string {
	const date = new Date(utcIso);
	return Number.isNaN(date.getTime())
		? "—"
		: date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
