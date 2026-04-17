import { TRPCError } from "@trpc/server";
import { env } from "./env";

export async function getIceServer() {
	// Generate TURN credentials
	const res = await fetch(
		`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_TOKEN}/credentials/generate-ice-servers`,
		{
			headers: {
				Authorization: `Bearer ${env.TURN_API_KEY}`,
				"Content-Type": "application/json",
			},
			method: "POST",
			body: JSON.stringify({
				ttl: 86400,
			}),
		},
	);
	if (res.ok) {
		return res.text();
	}
	return new TRPCError({
		code: "INTERNAL_SERVER_ERROR",
		message: "Failed to get TURN credentials",
	});
}
