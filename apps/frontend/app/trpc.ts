import { QueryClient } from "@tanstack/react-query";
import type { AppRouter } from "backend/trpc";

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: 1,
			refetchOnWindowFocus: false,
		},
	},
});
console.log("QueryClient initialized");

import { createTRPCContext } from "@trpc/tanstack-react-query";

export const { TRPCProvider, useTRPC, useTRPCClient } =
	createTRPCContext<AppRouter>();
console.log("TRPC context created");
