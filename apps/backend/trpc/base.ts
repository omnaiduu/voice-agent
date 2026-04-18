import { initTRPC } from "@trpc/server";

const t = initTRPC.create({
	sse: {
		ping: {
			enabled: true,
			intervalMs: 2000,
		},
	},
});

export { t };
export const router = t.router;
export const publicProcedure = t.procedure;
