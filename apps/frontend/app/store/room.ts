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

// Helper to get session ID for a track, handling edge cases explicitly
const getSessionIdForTrack = (
	track: CloudflareTrack,
	isMine: boolean,
	mySessionId: string,
): string | null => {
	if (track.sessionId) {
		return track.sessionId;
	}
	if (isMine) {
		return mySessionId;
	}
	// Edge case: non-mine track without sessionId, skip to avoid errors
	return null;
};

// Helper to create or update a participant with new tracks, immutably
const addTracksToParticipants = (
	participants: Record<string, Participant>,
	tracks: CloudflareTrack[],
	isMine: boolean,
	mySessionId: string,
): Record<string, Participant> => {
	let newParticipants = { ...participants };

	for (const track of tracks) {
		const sessionId = getSessionIdForTrack(track, isMine, mySessionId);
		if (!sessionId) {
			continue;
		}

		const existingParticipant = newParticipants[sessionId];
		if (!existingParticipant) {
			newParticipants = {
				...newParticipants,
				[sessionId]: {
					sessionId,
					tracks: {},
					mediaStream: new MediaStream(),
				},
			};
		}

		const participant = newParticipants[sessionId];
		const updatedTracks = {
			...participant.tracks,
			[track.mid]: {
				mid: track.mid,
				trackName: track.trackName,
				kind: track.kind,
			},
		};

		newParticipants = {
			...newParticipants,
			[sessionId]: {
				...participant,
				tracks: updatedTracks,
			},
		};
	}

	return newParticipants;
};

// Helper to attach a real track to the correct participant, immutably
const attachTrackToParticipant = (
	participants: Record<string, Participant>,
	mid: string,
	realTrack: MediaStreamTrack,
): Record<string, Participant> => {
	for (const [sessionId, participant] of Object.entries(participants)) {
		if (participant.tracks[mid]) {
			const updatedTracks = {
				...participant.tracks,
				[mid]: {
					...participant.tracks[mid],
					track: realTrack,
				},
			};

			const updatedMediaStream = new MediaStream([
				...participant.mediaStream.getTracks(),
				realTrack,
			]);

			return {
				...participants,
				[sessionId]: {
					...participant,
					tracks: updatedTracks,
					mediaStream: updatedMediaStream,
				},
			};
		}
	}
	// No participant found with this mid, return unchanged
	return participants;
};

// Helper to remove a participant and stop their tracks, immutably
const removeParticipantFromStore = (
	participants: Record<string, Participant>,
	sessionId: string,
): Record<string, Participant> => {
	const participant = participants[sessionId];
	if (!participant) {
		return participants;
	}

	// Stop all tracks before removing to free resources
	participant.mediaStream.getTracks().forEach((track) => {
		track.stop();
	});

	const { [sessionId]: _, ...remainingParticipants } = participants;
	return remainingParticipants;
};

// Fully typed store creator with no mutations inside set
const storeCreator: StateCreator<VoiceState> = (set) => ({
	mySessionId: "",
	participants: {},
	isConnected: false,
	status: "left",

	// Set the current connection status to track voice room lifecycle
	setStatus: (status: VoiceState["status"]) => set({ status }),

	// Set the current user's session ID for identification in the room
	setMySessionId: (id: string) => set({ mySessionId: id }),

	// Set whether the client is connected to the voice service
	setIsConnected: (connected: boolean) => set({ isConnected: connected }),

	consolidateTracks: (tracks: CloudflareTrack[], isMine = false) =>
		set((state) => ({
			participants: addTracksToParticipants(
				state.participants,
				tracks,
				isMine,
				state.mySessionId,
			),
		})),

	// Attach the real MediaStreamTrack to update participant media
	attachRealTrack: (mid: string, realTrack: MediaStreamTrack) =>
		set((state) => ({
			participants: attachTrackToParticipant(
				state.participants,
				mid,
				realTrack,
			),
		})),

	// Remove participant and clean up their resources
	removeParticipant: (sessionId: string) =>
		set((state) => ({
			participants: removeParticipantFromStore(state.participants, sessionId),
		})),

	// Reset the store to initial state when leaving the room
	reset: () =>
		set({
			mySessionId: "",
			participants: {},
			isConnected: false,
			status: "left",
		}),
});

// Production-safe devtools wrapper
export const useVoiceStore = create<VoiceState>()(
	devtools(storeCreator, {
		name: "voice-store",
		enabled: process.env.NODE_ENV === "development",
	}),
);

export const useVoiceSelector = <T>(selector: (s: VoiceState) => T) =>
	useVoiceStore(selector);
