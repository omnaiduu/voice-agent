// Import necessary hooks for data fetching
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc";

// Main component for testing tRPC integration
export default function TestPage() {
	// Initialize tRPC client
	const t = useTRPC();
	// Fetch data using the hello query
	const { data, isLoading, error } = useQuery(
		t.hello.queryOptions({
			name: "Remix + tRPC",
		}),
	);

	// Loading state
	if (isLoading) return <div className="p-8">Loading...</div>;
	// Error state
	if (error)
		return <div className="p-8 text-red-500">Error: {error.message}</div>;

	// Success state
	return (
		<div className="p-8">
			<h1 className="text-3xl font-bold">tRPC Test</h1>
			<p className="mt-6">
				Backend replied: <strong>{data}</strong>
			</p>
		</div>
	);
}
