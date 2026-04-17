import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc";

export default function TestPage() {
	return (
		<div className="p-8">
			<h1 className="text-3xl font-bold">Voice Agent Home</h1>
			<p className="mt-6">Welcome to the voice agent application.</p>
		</div>
	);
}
