// Redis utilities for managing room participants and real-time events

import { EventEmitter } from "node:events";
import Redis from "ioredis";
import { env } from "../config/env";

import type { Joined, Left, Room, RoomMembers, RoomRedis } from "../types";

// Global EventEmitter for handling Redis pub/sub events across the app
export const redisEvents = new EventEmitter();
redisEvents.setMaxListeners(500); // Allows up to 500 concurrent listeners for many rooms

/**
 * Cleans up event listeners for a specific room to prevent memory leaks
 */
export function cleanupRoomListeners(roomId: string): void {
	redisEvents.removeAllListeners(roomId);
}

// Shared Redis configuration
const redisConfig = {
	host: env.REDIS_HOST || "localhost",
	port: Number(env.REDIS_PORT) || 6379,
	maxRetriesPerRequest: 3,
	enableReadyCheck: true,
};

// Main Redis client for regular operations (get/set)
export const redis = new Redis(redisConfig);

// Separate Redis client for Pub/Sub operations (Redis doesn't allow pub/sub on same connection as other ops)
export const redisSub = new Redis(redisConfig);

// Single global message listener for all pub/sub channels - forwards Redis messages to EventEmitter
redisSub.on("message", (channel: string, message: string) => {
	redisEvents.emit(channel, message);
});
/**
 * Retrieves all participants in a room from Redis hash
 */
export async function getAllParticipants(
	roomId: string = "default",
): Promise<Room> {
	try {
		const data = (await redis.hgetall(roomId)) as RoomRedis;
		return parseRoom(data);
	} catch (error) {
		console.error(
			`Error retrieving all participants from room ${roomId}:`,
			error,
		);
		return {};
	}
}

/**
 * Adds a participant to a room and publishes a join event
 */
export async function addParticipant(
	roomId: string,
	sessionId: string,
	audioTrack: string,
	videoTrack: string,
): Promise<void> {
	try {
		const redisMulti = redis.multi();
		redisMulti.hset(
			roomId,
			sessionId,
			JSON.stringify({ audioTrack, videoTrack }),
		);
		const event: Joined = { type: "joined", sessionId };
		redisMulti.publish(roomId, JSON.stringify(event));

		await redisMulti.exec();
	} catch (error) {
		console.error(
			`Error adding participant ${sessionId} to room ${roomId}:`,
			error,
		);
		throw error;
	}
}

/**
 * Retrieves a specific participant's data from a room
 */
export async function getParticipant(
	roomId: string,
	sessionId: string,
): Promise<RoomMembers | null> {
	try {
		const data = await redis.hget(roomId, sessionId);
		if (!data) return null;
		return JSON.parse(data) as RoomMembers;
	} catch (error) {
		console.error(
			`Error retrieving participant ${sessionId} from room ${roomId}:`,
			error,
		);
		return null;
	}
}

/**
 * Removes a participant from a room and publishes a leave event
 */
export async function removeParticipant(
	roomId: string,
	sessionId: string,
): Promise<void> {
	try {
		const event: Left = { type: "left", sessionId };
		const redisMulti = redis.multi();
		redisMulti.publish(roomId, JSON.stringify(event));
		redisMulti.hdel(roomId, sessionId);
		await redisMulti.exec();
	} catch (error) {
		console.error(
			`Error removing participant ${sessionId} from room ${roomId}:`,
			error,
		);
		throw error;
	}
}

/**
 * Parses serialized room data from Redis back to Room object
 */
function parseRoom(data: RoomRedis): Room {
	try {
		const room = Object.fromEntries(
			Object.entries(data).map(([key, value]) => [key, JSON.parse(value)]),
		);
		return room as Room;
	} catch (error) {
		console.error("Error parsing room data:", error);
		return {};
	}
}
