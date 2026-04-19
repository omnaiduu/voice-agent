import { useEffect, useRef } from "react";
import { useShallow } from "zustand/shallow";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { VideoPlayer } from "~/components/VideoPlayer";
import { useRealtimeSFU } from "~/hooks/useRealtimeSFU";
import { useVoiceStore } from "~/store/room";
export default function Home() {
	console.log("body");
	const { join, leave, isConnected } = useRealtimeSFU();
	const { participants, mySessionId } = useVoiceStore(
		useShallow((s) => ({
			participants: s.participants,
			mySessionId: s.mySessionId,
		})),
	);

	const localParticipant = participants[mySessionId];
	const remoteParticipants = Object.entries(participants).filter(([id]) => id !== mySessionId);

	const handleJoin = async () => {
		try {
			await join();
		} catch (error) {
			console.error("Failed to join room:", error);
		}
	};

	const handleLeave = () => {
		leave();
	};

	return (
		<div className={isConnected ? "h-screen w-full relative bg-black" : "container mx-auto p-4 space-y-4"}>
			{isConnected ? (
				<>
					{remoteParticipants.length > 0 && (
						<VideoPlayer
							mediaStream={remoteParticipants[0][1].mediaStream}
							className="w-full h-full object-cover"
							muted={false}
						/>
					)}
					{localParticipant && (
						<div className="absolute bottom-4 right-4 w-32 h-24 border-2 border-white rounded overflow-hidden">
							<VideoPlayer
								mediaStream={localParticipant.mediaStream}
								className="w-full h-full object-cover"
								muted={true}
							/>
						</div>
					)}
					<div className="absolute top-4 left-4 space-y-2">
						<div className="flex items-center gap-2">
							<Badge variant="default" className="bg-white/20 text-white border-white/20">
								Connected
							</Badge>
						</div>
						<div className="flex gap-2">
							<Button onClick={handleLeave} variant="outline" className="bg-white/20 text-white border-white/20 hover:bg-white/30">
								Leave Room
							</Button>
						</div>
					</div>
				</>
			) : (
				<>
					<h1 className="text-2xl font-bold">Voice Agent Test - Default Room</h1>

					<div className="flex items-center gap-2">
						<Badge variant="secondary">
							Disconnected
						</Badge>
					</div>

					<div className="flex gap-2">
						<Button onClick={handleJoin} disabled={isConnected}>
							Join Room
						</Button>
						<Button onClick={handleLeave} disabled={!isConnected} variant="outline">
							Leave Room
						</Button>
					</div>

					<Card>
						<CardHeader>
							<CardTitle>
								Participants ({Object.keys(participants).length})
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2">
							{Object.entries(participants).map(([sessionId, participant]) => (
								<div key={sessionId} className="p-2 border rounded">
									<VideoPlayer mediaStream={participant.mediaStream} muted={sessionId === mySessionId} />
									<div className="flex items-center justify-between">
										<span>
											{sessionId === mySessionId ? "You" : "Participant"}:{" "}
											{sessionId}
										</span>
										<Badge variant="outline">
											Tracks: {Object.keys(participant.tracks).length}
										</Badge>
									</div>
								</div>
							))}
							{Object.keys(participants).length === 0 && (
								<p className="text-muted-foreground">No participants yet.</p>
							)}
						</CardContent>
					</Card>
				</>
			)}
		</div>
	);
}
