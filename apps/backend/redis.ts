import Redis from "ioredis";
import { env } from "./env";
import { EventEmitter } from "node:events";

import type { Joined, Left, Room, RoomMembers, RoomRedis } from "./types";

export const redisEvents = new EventEmitter();
redisEvents.setMaxListeners(500); // safe for many concurrent rooms

export const redis = new Redis({
	host: env.REDIS_HOST || "localhost",
	port: Number(process.env.REDIS_PORT) || 6379,
	maxRetriesPerRequest: 3,
	enableReadyCheck: true,
});

// Separate connection for Pub/Sub (required when using both publish and subscribe)
export const redisSub = new Redis({
	host: env.REDIS_HOST || "localhost",
	port: Number(process.env.REDIS_PORT) || 6379,
	maxRetriesPerRequest: 3,
});

// ONE SINGLE global listener — registered only once when app starts
redisSub.on("message", (channel: string, message: string) => {
	redisEvents.emit(channel, message);
});
export async function getAllParticipants(
	roomId: string = "default",
): Promise<Room> {
	const data = (await redis.hgetall(roomId)) as RoomRedis;

	return parseRoom(data);
}

export async function addParticipant(
	roomId: string,
	sessionId: string,
	audioTrack: string,
	videoTrack: string,
): Promise<void> {
	const redisMulti = redis.multi();
	redisMulti.hmset(
		roomId,
		serializeRoom({
			[sessionId]: { audioTrack, videoTrack },
		}),
	);
	const event: Joined = { type: "joined", sessionId };
	redisMulti.publish(roomId, JSON.stringify(event));
	await redisMulti.exec();
}

export async function getparticipant(
	roomId: string,
	sessionId: string,
): Promise<Room | null> {
	const data = (await redis.hget(roomId, sessionId)) as RoomRedis | null;
	if (!data) return null;

	return parseRoom(data);
}

export async function removeParticipant(
	roomId: string,
	sessionId: string,
): Promise<void> {
	const event: Left = { type: "left", sessionId };
	const redisMulti = redis.multi();
	redisMulti.publish(roomId, JSON.stringify(event));

	redisMulti.hdel(roomId, sessionId);
	await redisMulti.exec();
}

function parseRoom(data: RoomRedis): Room {
	const room = Object.fromEntries(
		Object.entries(data).map(([key, value]) => [key, JSON.parse(value)]),
	);
	return room as Room;
}

function serializeRoom(room: Room): RoomRedis {
	return Object.fromEntries(
		Object.entries(room).map(([key, value]) => [key, JSON.stringify(value)]),
	) as RoomRedis;
}
