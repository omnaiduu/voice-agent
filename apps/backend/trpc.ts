import { initTRPC, TRPCError } from "@trpc/server";
import { cf } from "./cloudflare";
import { env } from "./env";
import { getIceServer } from "./turn";
import z from "zod";
import {
	addParticipant,
	redisEvents,
	redisSub,
	removeParticipant,
	type RoomEvent,
} from "./redis";
import { on } from "node:events";
const t = initTRPC.create({
	sse: {
		ping: {
			enabled: true,
			intervalMs: 2000,
		},
	},
});

export const router = t.router;
export const publicProcedure = t.procedure;

const PushTrackResponseSchema = z.object({
	sessionDescription: z.object({
		sdp: z.string(),
	}),
	tracks: z
		.array(
			z.object({
				trackName: z.string(),
				mid: z.string(),
			}),
		)
		.min(2),
});

const TrackArray = z.array(
	z.object({
		sessionId: z.string(),
		trackName: z.string(),
	}),
);

const PullTracksResponseSchema = z.object({
	tracks: TrackArray,
	sessionDescription: z.object({
		sdp: z.string(),
	}),
});

export const appRouter = router({
	createSession: publicProcedure.mutation(async () => {
		try {
			const [{ data }, turnCredentials] = await Promise.all([
				cf.POST("/apps/{appId}/sessions/new", {
					params: {
						path: {
							appId: env.CF_APP_ID,
						},
					},
				}),
				getIceServer(),
			]);

			if (turnCredentials instanceof TRPCError) {
				throw turnCredentials;
			}

			if (data?.errorCode) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: data.errorCode,
				});
			}

			const sessionId = data?.sessionId;
			if (!sessionId) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Session was created without a sessionId",
				});
			}

			return { sessionId, turnCredentials };
		} catch (error) {
			if (error instanceof TRPCError) {
				throw error;
			}

			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to create session",
			});
		}
	}),
	pushTrack: publicProcedure
		.input(
			z.object({
				sessionId: z.string(),
				SDP: z.string(),
			}),
		)
		.mutation(async ({ input }) => {
			const { data, error } = await cf.POST(
				"/apps/{appId}/sessions/{sessionId}/tracks/new",
				{
					params: {
						path: {
							appId: env.CF_APP_ID,
							sessionId: input.sessionId,
						},
					},
					body: {
						sessionDescription: {
							type: "offer",
							sdp: input.SDP,
						},
						autoDiscover: true,
					},
				},
			);
			if (error || data.tracks?.length === 0) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to push track",
				});
			}

			const dataValidation = PushTrackResponseSchema.safeParse(data);
			if (!dataValidation.success) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Invalid response from Cloudflare",
				});
			}

			const { sessionDescription, tracks } = dataValidation.data;
			const track1 = tracks[0].trackName;
			const track2 = tracks[1].trackName;
			await addParticipant("default", input.sessionId, track1, track2);
			return { sdp: sessionDescription.sdp };
		}),
	pullTracks: publicProcedure
		.input(
			z.object({
				sessionId: z.string(),
				tracks: TrackArray,
			}),
		)
		.mutation(async ({ input }) => {
			const { data, error } = await cf.POST(
				"/apps/{appId}/sessions/{sessionId}/tracks/new",
				{
					params: {
						path: {
							appId: env.CF_APP_ID,
							sessionId: input.sessionId,
						},
					},
					body: {
						tracks: input.tracks.map((track) => ({
							location: "remote" as const,
							trackName: track.trackName,
							sessionId: track.sessionId,
						})),
					},
				},
			);
			if (error || !data) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to pull tracks",
				});
			}

			return data;
		}),
	renegotiate: publicProcedure
		.input(
			z.object({
				sessionId: z.string(),
				SDP: z.string(),
			}),
		)
		.mutation(async ({ input }) => {
			const { data, error } = await cf.PUT(
				"/apps/{appId}/sessions/{sessionId}/renegotiate",
				{
					params: {
						path: {
							appId: env.CF_APP_ID,
							sessionId: input.sessionId,
						},
					},
					body: {
						sessionDescription: {
							sdp: input.SDP,
						},
					},
				},
			);
			if (error || !data) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to renegotiate tracks",
				});
			}

			return data;
		}),

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
				//

				await Promise.allSettled([
					redisSub.unsubscribe(channel),
					removeParticipant(input.roomId, input.sessionId),
				]);
			}
		}),
});

export type AppRouter = typeof appRouter;
