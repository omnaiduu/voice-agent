import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc";

export default function TestPage() {
  const t = useTRPC()
  const { data, isLoading, error } = useQuery(t.hello.queryOptions({
    name: "Remix + tRPC",
  }))

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-500">Error: {error.message}</div>;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">tRPC Test</h1>
      <p className="mt-6">Backend replied: <strong>{data}</strong></p>
    </div>
  );
}