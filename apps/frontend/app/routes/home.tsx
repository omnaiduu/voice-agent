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
		<div className="container mx-auto p-4 space-y-4">
			<h1 className="text-2xl font-bold">Voice Agent Test - Default Room</h1>

			<div className="flex items-center gap-2">
				<Badge variant={isConnected ? "default" : "secondary"}>
					{isConnected ? "Connected" : "Disconnected"}
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
							<VideoPlayer mediaStream={participant.mediaStream} />
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
		</div>
	);
}
