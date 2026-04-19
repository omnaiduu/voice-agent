import { TRPCError } from "@trpc/server";
import z from "zod";
import { env } from "../config/env";
import { cf } from "../services/cloudflare";
import type { components } from "../services/cloudflare-sfu/types";
import {
	addParticipant,
	getAllParticipants,
	getParticipant,
} from "../services/redis";
import { getIceServer } from "../services/turn";
import { PullTracksResponseSchema, type Room } from "../types";
import { publicProcedure, router } from "./base";
import { PushTrackResponseSchema } from "./schemas";

export const sessionsRouter = router({
	// Creates a new WebRTC session
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
	// Pushes a track to the session
	pushTrack: publicProcedure
		.input(
			z.object({
				sessionId: z.string(),
				SDP: z.string(),
				roomId: z.string().default("default"),
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
			console.log(
				"[BACKEND] Raw Cloudflare API response data for pushTrack:",
				JSON.stringify(data, null, 2),
			);

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
			await addParticipant(input.roomId, input.sessionId, track1, track2);
			return { sdp: sessionDescription.sdp };
		}),

	// Pulls tracks from other participants
	pullTracks: publicProcedure
		.input(
			z.object({
				sessionId: z.string(),
				roomId: z.string().default("default"),
				participantSessionId: z.string().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			let room: Room;
			if (input.participantSessionId) {
				const participant = await getParticipant(
					input.roomId,
					input.participantSessionId,
				);
				if (!participant) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Participant not found in room",
					});
				}
				room = { [input.participantSessionId]: participant };
			} else {
				const allParticipants = await getAllParticipants(input.roomId);
				const { [input.sessionId]: _, ...filteredRoom } = allParticipants;
				room = filteredRoom;
			}

			if (Object.keys(room).length === 0) {
				console.log("[BACKEND] No remote participants to pull tracks for");
				return {
					tracks: [],
					sessionDescription: { type: "offer", sdp: "" }, // Minimal response
					requiresImmediateRenegotiation: false,
				};
			}

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
						tracks: Object.entries(room).flatMap(
							([sessionId, { audioTrack, videoTrack }]) => [
								{
									location: "remote" as const,
									sessionId,
									trackName: audioTrack,
								},
								{
									location: "remote" as const,
									sessionId,
									trackName: videoTrack,
								},
							],
						) as components["schemas"]["TrackObject"][],
					},
				},
			);

			if (error) {
				console.error("[BACKEND] Cloudflare API error in pullTracks:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to pull tracks",
				});
			}

			if (!data) {
				console.error("[BACKEND] No data from Cloudflare in pullTracks");
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to pull tracks",
				});
			}

			console.log(
				"[BACKEND] Raw Cloudflare API response data:",
				JSON.stringify(data, null, 2),
			);

			console.log("[BACKEND] Pull tracks successful, tracks count:", data.tracks?.length || 0);

			const dataValidation = PullTracksResponseSchema.safeParse(data);
			if (!dataValidation.success) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Invalid response from Cloudflare",
				});
			}

			return {
				...dataValidation.data,
			};
		}),
	// Renegotiates the session SDP
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
							type: "answer",
							sdp: input.SDP,
						},
					},
				},
			);
			if (error || !data) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to renegotiate session",
				});
			}

			return data;
		}),
});
