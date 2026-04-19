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
						yield parsed;
					} catch (parseErr) {
						console.error("Redis message parse error:", parseErr);
					}
				}
			} finally {
				await Promise.allSettled([
					redisSub.unsubscribe(channel),
					removeParticipant(input.roomId, input.sessionId),
				]);
			}
		}),
});
