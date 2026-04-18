import z from "zod";

export const PushTrackResponseSchema = z.object({
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
