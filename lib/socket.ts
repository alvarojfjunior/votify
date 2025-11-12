import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;
let serverEnsured = false;

export function ensureSocketServer() {
  if (serverEnsured) return;
  serverEnsured = true;
  fetch("/api/socket");
}

export function getSocket(): Socket {
  if (socket) return socket;
  socket = io({ path: "/api/socket_io", autoConnect: false, transports: ["websocket"] });
  return socket;
}

export function connectIfNeeded() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function onRoomState(handler: (state: any) => void) {
  const s = getSocket();
  s.on("room_state", handler);
}

export function offRoomState(handler: (state: any) => void) {
  const s = getSocket();
  s.off("room_state", handler);
}
