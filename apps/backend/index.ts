import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { appRouter } from "./trpc";

const server = createHTTPServer({
	router: appRouter,
	basePath: "/trpc/",
});

server.listen(3001, () => {
	console.log("✅ Backend running on http://localhost:3001");
});
