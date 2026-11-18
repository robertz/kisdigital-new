// One colour per kind of probe, the same on the chart, the legend and the
// chips. Picked to stay distinct in both light and dark themes.
export const CATEGORY_COLORS: Record<string, string> = {
	rce: "#d32f2f",
	sqli: "#ef6c00",
	traversal: "#f9a825",
	xss: "#c2185b",
	secrets: "#7b1fa2",
	wordpress: "#1976d2",
	admin: "#00838f",
	php: "#388e3c",
	scanner: "#6d4c41",
	method: "#607d8b",
};

export const CATEGORY_HELP: Record<string, string> = {
	rce: "Trying to run commands on the server: phpunit's eval-stdin, CGI scripts, Log4Shell, Shellshock.",
	sqli: "SQL in the path or query string, hoping it reaches a database query.",
	traversal: "Climbing out of the web root with ../, or reading /etc/passwd and /proc/self/environ.",
	xss: "Script tags and event handlers in the URL, hoping to be echoed back into a page.",
	secrets: "Dotfiles, .env, .git, cloud credentials, CI and Docker files, backups.",
	wordpress: "wp-login, wp-admin, xmlrpc.php and the rest of WordPress.",
	admin: "phpMyAdmin, Spring actuator, Laravel Telescope, server-status, GraphQL and Swagger consoles.",
	php: "PHP pages. This site serves none.",
	scanner: "Requests whose user agent names an attack tool (sqlmap, nuclei, zgrab, ...).",
	method: "WebDAV and debugging methods such as PROPFIND and TRACE.",
};
