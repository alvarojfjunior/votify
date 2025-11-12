import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;
let serverEnsured = false;

function getServerUrl() {
  const external = process.env.NEXT_PUBLIC_SOCKET_URL;
  return external && external.length ? external : "";
}

export function ensureSocketServer() {
  if (serverEnsured) return;
  serverEnsured = true;
  if (!getServerUrl()) fetch("/api/socket");
}

export function getSocket(): Socket {
  if (socket) return socket;
  const serverUrl = getServerUrl();
  const options = { path: "/api/socket_io", autoConnect: false, transports: ["websocket", "polling"], withCredentials: true };
  socket = serverUrl ? io(serverUrl, options) : io(options);
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
