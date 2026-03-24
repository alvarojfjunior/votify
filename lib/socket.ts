import { io, Socket } from "socket.io-client";

type SessionData = {
  roomId: string;
  name: string;
  isHost: boolean;
};

const SESSION_KEY = "votify_session";

export function saveSession(data: SessionData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save session:", e);
  }
}

export function getSession(): SessionData | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}

let socket: Socket | null = null;
let serverEnsured = false;
let serverPromise: Promise<void> | null = null;
let reconnectAttempts = 0;

export function ensureSocketServer(): Promise<void> {
  if (serverEnsured && serverPromise) return serverPromise;
  
  serverEnsured = true;
  serverPromise = fetch("/api/socket").then(() => {
    connectIfNeeded();
  }).catch((err) => {
    serverEnsured = false;
    serverPromise = null;
    console.error("Failed to ensure socket server:", err);
  });
  
  return serverPromise;
}

export function getSocket(): Socket {
  if (socket) return socket;
  socket = io({
    path: "/api/socket_io",
    autoConnect: false,
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });
  
  socket.on("connect", () => {
    reconnectAttempts = 0;
  });
  
  socket.on("reconnect", (attemptNumber) => {
    reconnectAttempts = attemptNumber;
    const roomId = getCurrentRoomId();
    if (roomId) {
      socket?.emit("get_room_state", { roomId }, (res: any) => {
        if (res?.ok) {
          socket?.emit("sync_state", { roomId });
        }
      });
    }
  });
  
  socket.on("disconnect", (reason) => {
    if (reason === "io server disconnect") {
      socket?.connect();
    }
  });
  
  return socket;
}

let currentRoomId: string | null = null;

function getCurrentRoomId(): string | null {
  return currentRoomId;
}

export function setCurrentRoomId(roomId: string | null) {
  currentRoomId = roomId;
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
