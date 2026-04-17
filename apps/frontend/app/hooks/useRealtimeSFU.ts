import { useRef, useCallback } from "react";

import { useVoiceStore } from "../store/room";

import { useTRPC } from "~/trpc";
import { useMutation } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";

export function useRealtimeSFU(roomId = "default") {
	const pcRef = useRef<RTCPeerConnection | null>(null);
	const localStreamRef = useRef<MediaStream | null>(null);
	const subscriptionRef = useRef(null);

	const t = useTRPC();
	const { mutateAsync, isPending } = useMutation(
		t.createSession.mutationOptions(),
	);

	const pullRemoteTracks = async (
		sessionId: string,
		remotesessionId?: string,
	) => {
		const pullres = await pullTracks({
			sessionId,
			participantSessionId: remotesessionId,
		});
		consolidateTracks(pullres.tracks);
		pcRef.current?.setRemoteDescription({
			type: "offer",
			sdp: pullres.sessionDescription.sdp,
		});
		const answer = await pcRef.current?.createAnswer();
		if (answer) {
			await pcRef.current?.setLocalDescription(answer);
			await renegotiate({
				sessionId,
				SDP: answer.sdp!,
			});
		}
	};
	const { mutateAsync: pushTrack } = useMutation(t.pushTrack.mutationOptions());
	const { mutateAsync: pullTracks } = useMutation(
		t.pullTracks.mutationOptions({}),
	);
	const { mutateAsync: renegotiate } = useMutation(
		t.renegotiate.mutationOptions({}),
	);

	const {
		consolidateTracks,
		attachRealTrack,
		removeParticipant,
		setMySessionId,
		reset,
		sessionId,
	} = useVoiceStore((s) => ({
		sessionId: s.mySessionId,
		consolidateTracks: s.consolidateTracks,
		attachRealTrack: s.attachRealTrack,
		removeParticipant: s.removeParticipant,
		setMySessionId: s.setMySessionId,
		reset: s.reset,
	}));

	const { reset: resetSubscription, status } = useSubscription(
		t.subscribeToRoom.subscriptionOptions(
			{
				sessionId: sessionId,
			},
			{
				onData: (event) => {
					console.log("Received room event:", event);
					if (event.type === "joined" && event.sessionId !== sessionId) {
						pullRemoteTracks(sessionId, event.sessionId);
					}
					if (event.type === "left") {
						removeParticipant(event.sessionId);
					}
				},
				onError(err) {
					console.error("Subscription error:", err);
				},
			},
		),
	);
	// Create PeerConnection (only once)

	const join = async () => {
		if (isPending) return;
		try {
			const { turnCredentials, sessionId } = await mutateAsync();
			console.log("Session created with ID:", sessionId);
			const pc = new RTCPeerConnection(
				JSON.parse(turnCredentials) as RTCConfiguration,
			);

			pcRef.current = pc;
			pc.ontrack = (e) => {
				const mid = e.transceiver?.mid;
				if (mid && e.track) attachRealTrack(mid, e.track);
			};
			setMySessionId(sessionId);

			console.log("Track pushed successfully");
			if (!pcRef.current) {
				console.error("PeerConnection not initialized");
				return;
			}
			const localStream = await navigator.mediaDevices
				.getUserMedia({ audio: true, video: true })
				.catch((err) => {
					console.error("Error accessing media devices:", err);

					console.error("Failed to get user media:", err);
					return null;
				});
            

				


			

				



			localStreamRef.current = localStream;
			if (!localStream) {
				console.error("No local stream available");

				return;
			}
			localStream.getTracks().forEach((track) => {
				pcRef.current?.addTransceiver(track, { direction: "sendonly" });
			});

			const offer = await pcRef.current.createOffer();
			await pcRef.current.setLocalDescription(offer);

			const pushRes = await pushTrack({
				sessionId,
				SDP: offer.sdp!,
			});

			await pcRef.current.setRemoteDescription({
				type: "answer",
				sdp: pushRes.sdp,
			});
			console.log("Session setup complete");

			pullRemoteTracks(sessionId);
		} catch (error) {
			console.error("Failed to create session", error);
		}
	};

	const leave = () => {
		resetSubscription();
		pcRef.current?.close();
		localStreamRef.current?.getTracks().forEach((t) => {
			t.stop();
		});
		reset();
	};

	return { join, leave, isConnected: useVoiceStore((s) => s.isConnected) };
}
