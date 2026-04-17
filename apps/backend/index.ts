// Import the HTTP server adapter for tRPC standalone mode
import { createHTTPServer } from "@trpc/server/adapters/standalone";
// Import the main tRPC router
import { appRouter } from "./trpc";

// Create the HTTP server with tRPC integration
const server = createHTTPServer({
	router: appRouter, // Use the app router for handling requests
	basePath: "/trpc/", // Set the base path for tRPC endpoints
});

// Start the server on port 3001
server.listen(3001, () => {
	console.log("✅ Backend running on http://localhost:3001");
});
