import { t } from "./base";
import { roomsRouter } from "./rooms";
import { sessionsRouter } from "./sessions";

export const appRouter = t.mergeRouters(sessionsRouter, roomsRouter);

export type AppRouter = typeof appRouter;
