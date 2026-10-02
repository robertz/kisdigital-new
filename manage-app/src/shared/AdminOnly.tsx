import type { ReactNode } from "react";
import Alert from "@mui/material/Alert";
import { isAdmin } from "../app/boot";
import { Page } from "./Page";

// The API refuses these pages' data to anyone but an admin; this only saves
// an author who typed the address from a page of failed requests.
export function AdminOnly({ children }: { children: ReactNode }) {
	if (isAdmin) return <>{children}</>;
	return (
		<Page>
			<Alert severity="warning">Only an admin can open this page.</Alert>
		</Page>
	);
}
