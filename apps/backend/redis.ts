// Redis utilities for managing room participants and real-time events

import { EventEmitter } from "node:events";
import Redis from "ioredis";
import { env } from "./env";

import type { Joined, Left, Room, RoomMembers, RoomRedis } from "./types";

// Global EventEmitter for handling Redis pub/sub events across the app
export const redisEvents = new EventEmitter();
redisEvents.setMaxListeners(500); // Allows up to 500 concurrent listeners for many rooms

// Main Redis client for regular operations (get/set)
export const redis = new Redis({
	host: env.REDIS_HOST || "localhost",
	port: Number(process.env.REDIS_PORT) || 6379,
	maxRetriesPerRequest: 3,
	enableReadyCheck: true,
});

// Separate Redis client for Pub/Sub operations (Redis doesn't allow pub/sub on same connection as other ops)
export const redisSub = new Redis({
	host: env.REDIS_HOST || "localhost",
	port: Number(process.env.REDIS_PORT) || 6379,
	maxRetriesPerRequest: 3,
});

// Single global message listener for all pub/sub channels - forwards Redis messages to EventEmitter
redisSub.on("message", (channel: string, message: string) => {
	redisEvents.emit(channel, message);
});
// Retrieves all participants in a room from Redis hash
export async function getAllParticipants(
	roomId: string = "default",
): Promise<Room> {
	const data = (await redis.hgetall(roomId)) as RoomRedis;

	return parseRoom(data);
}

// Adds a participant to a room and publishes a join event
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

// Retrieves a specific participant's data from a room
export async function getParticipant(
	roomId: string,
	sessionId: string,
): Promise<Room | null> {
	const data = (await redis.hget(roomId, sessionId)) as RoomRedis | null;
	if (!data) return null;

	return parseRoom(data);
}

// Removes a participant from a room and publishes a leave event
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

// Parses serialized room data from Redis back to Room object
function parseRoom(data: RoomRedis): Room {
	const room = Object.fromEntries(
		Object.entries(data).map(([key, value]) => [key, JSON.parse(value)]),
	);
	return room as Room;
}

// Serializes Room object for storage in Redis
function serializeRoom(room: Room): RoomRedis {
	return Object.fromEntries(
		Object.entries(room).map(([key, value]) => [key, JSON.stringify(value)]),
	) as RoomRedis;
}
