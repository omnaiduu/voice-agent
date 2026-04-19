import { on } from "node:events";
import z from "zod";
import { redisEvents, redisSub, removeParticipant } from "../services/redis";
import type { RoomEvent } from "../types";
import { publicProcedure, router } from "./base";

/**
 * Router for room-related operations.
 */
export const roomsRouter = router({
	/**
	 * Subscribes to room events for a given room and session.
	 */
	subscribeToRoom: publicProcedure
		.input(
			z.object({
				roomId: z.string().default("default"),
				sessionId: z.string(),
			}),
		)
		.subscription(async function* ({ input, signal }) {
			const channel = input.roomId;

			

			await redisSub.subscribe(channel);

			try {
				for await (const [rawMessage] of on(redisEvents, channel, { signal })) {
					try {
						const parsed = JSON.parse(rawMessage) as RoomEvent;
						
						if(parsed.sessionId == input.sessionId) {
							console.warn(`[BACKEND] ignoring event for session ${parsed.sessionId} as it matches the subscriber's sessionId ${input.sessionId}`);
							continue;
						} else {
console.log("[BACKEND] Room event received:", parsed);
							yield parsed;
						}
					} catch (parseErr) {
						console.error("[BACKEND] Room event parse error:", parseErr);
					}
				}
			} catch (error) {
				console.error("[BACKEND] Room subscription error:", error);
			} finally {
				console.log(`[SUB] FINALLY RUNNING for room:${input.roomId} session:${input.sessionId}`);
				await Promise.allSettled([
					redisSub.unsubscribe(channel),
					removeParticipant(input.roomId, input.sessionId),
				]);
				console.log(`[SUB] Cleanup complete for room:${input.roomId} session:${input.sessionId}`);
			}
		}),
});
