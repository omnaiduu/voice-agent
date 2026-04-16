import type { PullTracksResponse } from "backend/roomTypes";

export type CloudflareTrack = PullTracksResponse["tracks"][number];

export interface Participant {
	sessionId: string;
	tracks: Record<
		string,
		{
			mid: string;
			trackName: string;
			kind?: "audio" | "video";
			track?: MediaStreamTrack;
		}
	>;
	mediaStream: MediaStream;
}
