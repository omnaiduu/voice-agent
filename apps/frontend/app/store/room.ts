import type { StateCreator } from "zustand";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { CloudflareTrack, Participant } from "../types";

interface VoiceState {
	status: "joining" | "joined" | "leaving" | "left" | "error";
	mySessionId: string;
	participants: Record<string, Participant>;
	isConnected: boolean;

	setMySessionId: (id: string) => void;
	consolidateTracks: (tracks: CloudflareTrack[], isMine?: boolean) => void;
	attachRealTrack: (mid: string, track: MediaStreamTrack) => void;
	removeParticipant: (sessionId: string) => void;
	reset: () => void;
	setStatus: (status: VoiceState["status"]) => void;
	setIsConnected: (connected: boolean) => void;
}

// Fully typed store creator (no `any`
//
const storeCreator: StateCreator<VoiceState> = (set) => ({
	mySessionId: "",
	participants: {},
	isConnected: false,
	status: "left",
	// Set the current connection status
	setStatus: (status: VoiceState["status"]) => set({ status }),

	// Set the current user's session ID
	setMySessionId: (id: string) => set({ mySessionId: id }),
	setIsConnected: (connected: boolean) => set({ isConnected: connected }),
	consolidateTracks: (tracks: CloudflareTrack[], isMine = false) =>
		set((state) => {
			const participants = { ...state.participants };

			tracks.forEach((t) => {
				const sessionId =
					t.sessionId || (isMine ? state.mySessionId : t.sessionId!);
				if (!participants[sessionId]) {
					participants[sessionId] = {
						sessionId,
						tracks: {},
						mediaStream: new MediaStream(),
					};
				}
				const p = participants[sessionId];
				p.tracks[t.mid] = {
					mid: t.mid,
					trackName: t.trackName,
					kind: t.kind,
				};
			});

			return { participants };
		}),
	// Attach the real MediaStreamTrack to the participant and add it to their MediaStream
	attachRealTrack: (mid: string, realTrack: MediaStreamTrack) =>
		set((state) => {
			const participants = { ...state.participants };
			for (const p of Object.values(participants)) {
				if (p.tracks[mid]) {
					p.tracks[mid].track = realTrack;
					p.mediaStream.addTrack(realTrack);
					break;
				}
			}
			return { participants };
		}),
	// Remove participant and stop their tracks
	removeParticipant: (sessionId: string) =>
		set((state) => {
			const participants = { ...state.participants };
			const p = participants[sessionId];
			if (p)
				p.mediaStream.getTracks().forEach((t) => {
					t.stop();
				});
			delete participants[sessionId];
			return { participants };
		}),

	// Reset the store to its initial state
	reset: () => set({ mySessionId: "", participants: {}, isConnected: false }),
});

// Production-safe devtools wrapper
export const useVoiceStore = create<VoiceState>()(
	devtools(storeCreator, {
		name: "voice-store",
		enabled: process.env.NODE_ENV === "development", // ← this removes the TS error
	}),
);

export const useVoiceSelector = <T>(selector: (s: VoiceState) => T) =>
	useVoiceStore(selector);
