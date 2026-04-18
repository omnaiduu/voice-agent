import { on } from "node:events";
import z from "zod";
import { redisEvents, redisSub, removeParticipant } from "../services/redis";
import type { RoomEvent } from "../types";
import { publicProcedure, router } from "./base";

export const roomsRouter = router({
	// Subscribes to room events
	subscribeToRoom: publicProcedure
		.input(
			z.object({
				roomId: z.string().default("default"),
				sessionId: z.string(),
			}),
		)
		.subscription(async function* ({ input, signal }) {
			const channel = input.roomId;

			// Subscribe to Redis channel (safe to call multiple times)
			await redisSub.subscribe(channel).catch(() => {});

			try {
				// This is the clean modern pattern
				for await (const [rawMessage] of on(redisEvents, channel, { signal })) {
					try {
						const parsed = JSON.parse(rawMessage) as RoomEvent;
						yield parsed;
					} catch (parseErr) {
						console.error("Redis message parse error:", parseErr);
					}
				}
			} finally {
				// Perfect cleanup when client leaves / disconnects
				// No need to check if subscribed, unsubscribe is idempotent
				// We use Promise.allSettled to ensure both operations are attempted, even if one fails
				// This prevents potential memory leaks from lingering subscriptions if removeParticipant fails

				await Promise.allSettled([
					redisSub.unsubscribe(channel),
					removeParticipant(input.roomId, input.sessionId),
				]);
			}
		}),
});
