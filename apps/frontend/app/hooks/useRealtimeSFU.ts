import { useMutation } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";
import { useRef } from "react";
import { useTRPC } from "~/trpc";
import { useVoiceStore } from "../store/room";

export function useRealtimeSFU(_roomId = "default") {
	const pcRef = useRef<RTCPeerConnection | null>(null);
	const localStreamRef = useRef<MediaStream | null>(null);
	const _subscriptionRef = useRef(null);

	const t = useTRPC();
	const { mutateAsync, isPending } = useMutation(
		t.createSession.mutationOptions(),
	);

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
		setStatus,
		setIsConnected,
		sessionId,
	} = useVoiceStore((s) => ({
		sessionId: s.mySessionId,
		consolidateTracks: s.consolidateTracks,
		attachRealTrack: s.attachRealTrack,
		removeParticipant: s.removeParticipant,
		setMySessionId: s.setMySessionId,
		reset: s.reset,
		setStatus: s.setStatus,
		setIsConnected: s.setIsConnected,
	}));

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
				SDP: answer.sdp as string,
			});
		}
	};

	const { reset: resetSubscription } = useSubscription(
		t.subscribeToRoom.subscriptionOptions(
			{
				sessionId: sessionId,
			},
			{
				enabled: !!sessionId,
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

	const setupPeerConnection = (turnCredentials: string): RTCPeerConnection => {
		const pc = new RTCPeerConnection(
			JSON.parse(turnCredentials) as RTCConfiguration,
		);
		pc.ontrack = (e) => {
			const mid = e.transceiver?.mid;
			if (mid && e.track) attachRealTrack(mid, e.track);
		};
		return pc;
	};

	const getLocalMedia = async (): Promise<MediaStream | null> => {
		try {
			return await navigator.mediaDevices.getUserMedia({
				audio: true,
				video: true,
			});
		} catch (err) {
			console.error("Error accessing media devices:", err);
			return null;
		}
	};

	const pushLocalTracks = async (pc: RTCPeerConnection, sessionId: string) => {
		const offer = await pc.createOffer();
		await pc.setLocalDescription(offer);

		// Consolidate local tracks into store
		pc.getTransceivers().forEach((transceiver) => {
			if (transceiver.mid && transceiver.sender.track) {
				consolidateTracks(
					[
						{
							mid: transceiver.mid,
							trackName: transceiver.sender.track.kind,
							sessionId,
							kind: transceiver.sender.track.kind as "audio" | "video",
						},
					],
					true,
				);
			}
		});

		const pushRes = await pushTrack({
			sessionId,
			SDP: offer.sdp as string,
		});

		await pc.setRemoteDescription({
			type: "answer",
			sdp: pushRes.sdp,
		});
	};

	const join = async () => {
		if (isPending) return;
		try {
			const { turnCredentials, sessionId } = await mutateAsync();
			console.log("Session created with ID:", sessionId);

			const pc = setupPeerConnection(turnCredentials);
			pcRef.current = pc;
			setMySessionId(sessionId);

			if (!pcRef.current) {
				console.error("PeerConnection not initialized");
				return;
			}

			const localStream = await getLocalMedia();
			localStreamRef.current = localStream;
			if (!localStream) {
				console.error("No local stream available");
				return;
			}

			localStream.getTracks().forEach((track) => {
				pcRef.current?.addTransceiver(track, { direction: "sendonly" });
			});

			await pushLocalTracks(pc, sessionId);
			console.log("Session setup complete");

			setStatus("joined");
			setIsConnected(true);

			pullRemoteTracks(sessionId);
		} catch (error) {
			console.error("Failed to create session", error);
			setStatus("error");
		}
	};

	const leave = () => {
		setStatus("left");
		setIsConnected(false);
		resetSubscription();
		pcRef.current?.close();
		localStreamRef.current?.getTracks().forEach((t) => {
			t.stop();
		});
		reset();
	};

	return { join, leave, isConnected: useVoiceStore((s) => s.isConnected) };
}
