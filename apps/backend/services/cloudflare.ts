import createClient from "openapi-fetch";
import { env } from "../config/env";
import type { paths } from "./cloudflare-sfu/types";

export const cf = createClient<paths>({
	baseUrl: "https://rtc.live.cloudflare.com/v1",
	headers: {
		Authorization: `Bearer ${env.CF_CALL_API_TOKEN}`,
	},
});
