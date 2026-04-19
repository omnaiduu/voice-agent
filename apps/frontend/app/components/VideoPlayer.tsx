import { useEffect, useRef } from "react";

interface VideoPlayerProps {
	mediaStream?: MediaStream;
	className?: string;
	muted?: boolean;
}

export const VideoPlayer = ({ mediaStream, className, muted = true }: VideoPlayerProps) => {
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
			muted={muted}
			className={className || "w-full h-32 object-cover rounded mb-2"}
		/>
	) : null;
};