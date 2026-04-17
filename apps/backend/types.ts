import z from "zod";

export type Participant = {
	sessionId: string;
	voiceId: string;
	audioId: string;
};

export const PullTracksResponseSchema = z.object({
	tracks: z.array(
		z.object({
			sessionId: z.string(),
			trackName: z.string(),
			mid: z.string(),
			kind: z.enum(["audio", "video"]),
		}),
	),
	sessionDescription: z.object({
		sdp: z.string(),
	}),
});

export type PullTracksResponse = z.infer<typeof PullTracksResponseSchema>;

export type Joined = {
	type: "joined";
	sessionId: string;
};

export type Left = {
	type: "left";
	sessionId: string;
};

export interface RoomMembers {
	audioTrack: string;
	videoTrack: string;
}

export interface Room {
	[sessionid: string]: RoomMembers;
}

export type RoomRedis = {
	[sessionid: string]: string;
};

export type RoomEvent = Joined | Left;
