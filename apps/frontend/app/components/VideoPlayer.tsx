import { useEffect, useRef } from "react";

interface VideoPlayerProps {
	mediaStream?: MediaStream;
}

export const VideoPlayer = ({ mediaStream }: VideoPlayerProps) => {
	const videoRef = useRef<HTMLVideoElement>(null);
	useEffect(() => {
		if (videoRef.current) {
			videoRef.current.srcObject = mediaStream || null;
		}
	}, [mediaStream]);
	return mediaStream ? (
		<video
			ref={videoRef}
			autoPlay
			muted
			className="w-full h-32 object-cover rounded mb-2"
		/>
	) : null;
};