// Publish dates travel as UTC ("2026-10-12T13:00:00Z") and are shown in the
// browser's own time zone.
function parseUtc(value: string): Date | null {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function pad(value: number): string {
	return String(value).padStart(2, "0");
}

/** A UTC publish date as a datetime-local input's value, in local time. */
export function toLocalInput(utcIso: string): string {
	const date = parseUtc(utcIso);
	if (!date) return "";
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** A datetime-local input's value (local time) as UTC, for the server. */
export function fromLocalInput(local: string): string {
	if (!local) return "";
	const date = new Date(local);
	return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

/** The browser's time zone, e.g. "America/New_York (EDT)". */
export function localZoneLabel(): string {
	const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	const short = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
		.formatToParts(new Date())
		.find((part) => part.type === "timeZoneName")?.value;
	return short && short !== zone ? `${zone} (${short})` : zone;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatLocalDate(value: string): string {
	const date = parseUtc(value);
	return date ? `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}` : "—";
}

export function formatLocalDateTime(value: string): string {
	const date = parseUtc(value);
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
