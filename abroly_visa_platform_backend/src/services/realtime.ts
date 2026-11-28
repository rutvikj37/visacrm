import http from "http";
import Jwt from "jsonwebtoken";
import Agent from "../model/Agent";
import User from "../model/User";
import { Server } from "socket.io";
import { createAdapter, setupPrimary } from "@socket.io/cluster-adapter";

/**
 * Realtime chat updates over WebSocket (Socket.IO), path /socket.io on the API port.
 *
 * Events only say "something changed" ({ student_id }); clients then reload through the normal
 * API, which keeps all permission checks (branch scoping etc.) in one place.
 *
 * Rooms:
 *   agency:<agency_uuid>  agency owner + staff (inbox list, unread badge, open thread)
 *   student:<id>          the student (their chat)
 *
 * The API runs one process per CPU (node cluster). The cluster adapter relays events through
 * the primary process, so a message sent via one worker reaches sockets held by any worker.
 * Clients use the websocket transport only, so no sticky sessions are needed.
 */

let io: Server | null = null;

/** Call once in the cluster primary. */
export const setupRealtimePrimary = () => setupPrimary();

/** Call once per worker with its HTTP server. */
export const startRealtime = (server: http.Server) => {
    io = new Server(server, {
        path: "/socket.io",
        transports: ["websocket"],
        // portals on custom agency domains connect too; auth is the JWT below, not the origin
        cors: { origin: (origin, cb) => cb(null, true), credentials: false },
    });
    try {
        io.adapter(createAdapter());
    } catch (error) {
        console.warn("Realtime: cluster adapter unavailable, events stay inside this worker", error);
    }

    io.use(async (socket, next) => {
        try {
            const token = String(socket.handshake.auth?.token || "").replace(/^Bearer\s+/i, "");
            if (!token) return next(new Error("unauthorized"));
            const decoded: any = Jwt.verify(token, String(process.env.ACCESS_TOKEN_SECRET || ""));
            const u: any = decoded?.user?.user || {};
            if (!u.id) return next(new Error("unauthorized"));
            // same rules as the API: account still exists / active, login not signed out since
            const row: any = u.agent_uuid
                ? await Agent.findOne({ where: { id: u.id, status: "active" }, attributes: ["uuid", "tokens_valid_after"] })
                : await User.findOne({ where: { id: u.id }, attributes: ["uuid", "tokens_valid_after"] });
            if (!row || row.dataValues.uuid !== u.uuid) return next(new Error("unauthorized"));
            const after = row.dataValues.tokens_valid_after;
            if (after && Number(decoded.iat) <= Math.floor(new Date(after).getTime() / 1000)) return next(new Error("unauthorized"));
            if (u.agent_uuid) socket.data.room = `agency:${u.agent_uuid}`; // agency owner / staff
            else socket.data.room = `student:${Number(u.id)}`; // student
            next();
        } catch {
            next(new Error("unauthorized"));
        }
    });

    io.on("connection", (socket) => {
        socket.join(socket.data.room);
    });
};

/** Tell the agency's staff and the student that this student's chat changed. Never throws. */
export const emitChatUpdate = (agencyUuid: string, studentId: number) => {
    try {
        if (!io) return;
        const payload = { student_id: studentId, at: Date.now() };
        io.to(`agency:${agencyUuid}`).to(`student:${studentId}`).emit("chat:update", payload);
    } catch (error) {
        console.error("emitChatUpdate", error);
    }
};
