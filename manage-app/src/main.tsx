import "@vitejs/plugin-react/preamble";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { ApiError } from "./app/api";
import { router } from "./app/router";
import { ManageTheme } from "./app/theme";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			refetchOnWindowFocus: false,
			// An answer from the server is final; only a request that never
			// got one (a dropped connection) is worth a second try.
			retry: (failureCount, error) => !(error instanceof ApiError) && failureCount < 1,
		},
	},
});

createRoot(document.getElementById("manage-root")!).render(
	<StrictMode>
		<ManageTheme>
			<QueryClientProvider client={queryClient}>
				<RouterProvider router={router} />
			</QueryClientProvider>
		</ManageTheme>
	</StrictMode>,
);
