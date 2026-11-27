import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { io, Socket } from "socket.io-client";

/**
 * One shared WebSocket to the API (Socket.IO at /socket.io) for live chat updates.
 * The server only says which student's chat changed ({ student_id }); screens then reload
 * through the normal API. A slow fallback poll stays in each screen in case the socket is down.
 */
export type ChatUpdate = { student_id?: number; reconnected?: boolean };

let socket: Socket | null = null;
let currentToken = "";
const listeners = new Set<(u: ChatUpdate) => void>();

const apiOrigin = () => {
    try {
        return new URL(String(import.meta.env.VITE_API_BASE_URL || "/"), window.location.href).origin;
    } catch {
        return window.location.origin;
    }
};

const connect = (token: string) => {
    if (!token) {
        socket?.disconnect();
        socket = null;
        currentToken = "";
        return;
    }
    if (socket && currentToken === token) return;
    socket?.disconnect();
    currentToken = token;
    let connectedBefore = false;
    socket = io(apiOrigin(), { path: "/socket.io", transports: ["websocket"], auth: { token } });
    socket.on("chat:update", (u: ChatUpdate) => listeners.forEach((l) => l(u || {})));
    // after a dropped connection, reload once to catch anything missed while offline
    socket.on("connect", () => {
        if (connectedBefore) listeners.forEach((l) => l({ reconnected: true }));
        connectedBefore = true;
    });
};

/** Calls handler whenever a portal chat changes (and once after a reconnect). */
export const useChatUpdates = (handler: (u: ChatUpdate) => void) => {
    const token = useSelector((state: any) => state.login?.token) as string | undefined;
    const ref = useRef(handler);
    ref.current = handler;
    useEffect(() => {
        connect(token || "");
        const fn = (u: ChatUpdate) => ref.current(u);
        listeners.add(fn);
        return () => { listeners.delete(fn); };
    }, [token]);
};
