import type { NextApiRequest, NextApiResponse } from "next";
import { Server as IOServer } from "socket.io";
import { randomUUID } from "crypto";

type Participant = {
  socketId: string;
  name: string;
  isHost: boolean;
  isSpectator: boolean;
  voted: boolean;
};

type Issue = {
  id: string;
  title: string;
  votes: Map<string, number>;
  revealed: boolean;
};

type Room = {
  id: string;
  name: string;
  hostSocketId: string;
  hostName: string;
  originalHostName: string;
  participants: Map<string, Participant>;
  issues: Map<string, Issue>;
  currentIssueId: string | null;
  status: "idle" | "voting" | "revealed";
  createdAt: number;
};

const g: any = globalThis as any;
const rooms: Map<string, Room> = g.__votify_rooms || new Map();
if (!g.__votify_rooms) g.__votify_rooms = rooms;

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const ROOM_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

function cleanupOldRooms() {
  const now = Date.now();
  let removed = 0;
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.createdAt > ROOM_MAX_AGE_MS) {
      rooms.delete(roomId);
      removed++;
    }
  }
  if (removed > 0) {
    console.log(`[votify] Cleanup: removed ${removed} old rooms`);
  }
}

let cleanupInterval: NodeJS.Timeout | null = null;
function startCleanupCron() {
  cleanupOldRooms();
  cleanupInterval = setInterval(cleanupOldRooms, CLEANUP_INTERVAL_MS);
}

if (!g.__votify_cleanup_started) {
  g.__votify_cleanup_started = true;
  startCleanupCron();
}

function buildRoomState(room: Room, requestingSocketId?: string) {
  const participants = Array.from(room.participants.values()).map((p) => ({
    name: p.name,
    avatar: p.name,
    isHost: p.isHost,
    isSpectator: p.isSpectator,
    voted: p.voted,
    socketId: p.socketId,
  }));
  const hostParticipant = Array.from(room.participants.values()).find(p => p.isHost);
  const issue = room.currentIssueId ? room.issues.get(room.currentIssueId) || null : null;
  const totalCount = participants.length;
  const votedCount = participants.filter((p) => p.voted).length;
  let currentIssue: any = null;
  if (issue) {
    currentIssue = { id: issue.id, title: issue.title, revealed: issue.revealed };
    if (issue.revealed) {
      const votesArray = Array.from(issue.votes.entries());
      const byName = votesArray.map(([sid, v]) => ({
        name: room.participants.get(sid)?.name || sid,
        value: v,
      }));
      const avg = votesArray.length ? votesArray.reduce((a, b) => a + b[1], 0) / votesArray.length : 0;
      currentIssue.votes = byName;
      currentIssue.average = Number(avg.toFixed(2));
    }
  }
  return {
    roomId: room.id,
    roomName: room.name,
    status: room.status,
    hostName: room.hostName,
    hostSocketId: room.hostSocketId,
    participants,
    currentIssue,
    votedCount,
    totalCount,
  } as any;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const server = (res.socket as any).server;
  
  if (server.io) {
    res.end();
    return;
  }

  const io = new IOServer(server, {
    path: "/api/socket_io",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });
  
  server.io = io;

  io.on("connection", (socket) => {
    socket.on("create_room", ({ hostName, roomName, isSpectator }: { hostName: string; roomName: string; isSpectator: boolean }, cb) => {
      const id = randomUUID();
      const room: Room = {
        id,
        name: roomName || "Sala",
        hostSocketId: socket.id,
        hostName: hostName || "Host",
        originalHostName: hostName || "Host",
        participants: new Map(),
        issues: new Map(),
        currentIssueId: null,
        status: "idle",
        createdAt: Date.now(),
      };
      room.participants.set(socket.id, { socketId: socket.id, name: room.hostName, isHost: true, isSpectator: isSpectator || false, voted: false });
      rooms.set(id, room);
      socket.join(id);
      io.to(id).emit("room_state", buildRoomState(room));
      cb?.({ ok: true, roomId: id });
    });

    socket.on("join_room", ({ roomId, name }: { roomId: string; name: string }, cb) => {
      const room = rooms.get(roomId);
      if (!room) {
        cb?.({ ok: false, error: "Sala não encontrada" });
        return;
      }
      const isNoHost = !room.hostSocketId;
      room.participants.set(socket.id, { socketId: socket.id, name: name || "Convidado", isHost: isNoHost, isSpectator: false, voted: false });
      if (isNoHost) {
        room.hostSocketId = socket.id;
        room.hostName = name || "Convidado";
      }
      socket.join(roomId);
      const state = buildRoomState(room);
      const issue = room.currentIssueId ? room.issues.get(room.currentIssueId) : null;
      if (issue) {
        state.myVote = issue.votes.get(socket.id) ?? null;
      }
      io.to(roomId).emit("room_state", buildRoomState(room));
      cb?.({ ok: true, state });
    });

    socket.on("rejoin_room", ({ roomId, name }: { roomId: string; name: string }, cb) => {
      const room = rooms.get(roomId);
      if (!room) {
        cb?.({ ok: false, error: "Sala não encontrada" });
        return;
      }
      
      const existingHost = Array.from(room.participants.values()).find(p => p.isHost && p.name === name);
      if (existingHost && existingHost.socketId !== socket.id) {
        room.participants.delete(existingHost.socketId);
      }
      
      const existing = Array.from(room.participants.values()).find(p => p.name === name && !p.isHost);
      if (existing) {
        room.participants.delete(existing.socketId);
      }
      
      const isOriginalHost = room.originalHostName === name;
      room.participants.set(socket.id, { 
        socketId: socket.id, 
        name: name || "Convidado", 
        isHost: isOriginalHost || room.participants.size === 0, 
        isSpectator: false, 
        voted: false 
      });
      
      if (isOriginalHost) {
        room.hostSocketId = socket.id;
      }
      
      socket.join(roomId);
      io.to(roomId).emit("room_state", buildRoomState(room));
      cb?.({ ok: true, state: buildRoomState(room) });
    });

    socket.on("create_issue", ({ roomId, title }: { roomId: string; title: string }, cb) => {
      const room = rooms.get(roomId);
      if (!room) {
        cb?.({ ok: false, error: "Sala não encontrada" });
        return;
      }
      if (socket.id !== room.hostSocketId) {
        cb?.({ ok: false, error: "Apenas o host pode criar" });
        return;
      }
      const issueId = randomUUID();
      const issue: Issue = { id: issueId, title: title || "Issue", votes: new Map(), revealed: false };
      room.issues.set(issueId, issue);
      room.currentIssueId = issueId;
      room.status = "voting";
      for (const p of room.participants.values()) p.voted = false;
      io.to(roomId).emit("room_state", buildRoomState(room));
      cb?.({ ok: true });
    });

    socket.on("cast_vote", ({ roomId, issueId, value }: { roomId: string; issueId: string; value: number }, cb) => {
      const room = rooms.get(roomId);
      if (!room) {
        cb?.({ ok: false });
        return;
      }
      const issue = room.issues.get(issueId);
      if (!issue || room.currentIssueId !== issueId) {
        cb?.({ ok: false });
        return;
      }
      if (value < 0 || value > 5) {
        cb?.({ ok: false });
        return;
      }
      issue.votes.set(socket.id, value);
      const participant = room.participants.get(socket.id);
      if (participant) participant.voted = true;
      io.to(roomId).emit("room_state", buildRoomState(room));
      cb?.({ ok: true });
    });

    socket.on("reveal_votes", ({ roomId }: { roomId: string }, cb) => {
      const room = rooms.get(roomId);
      if (!room) {
        cb?.({ ok: false });
        return;
      }
      if (socket.id !== room.hostSocketId) {
        cb?.({ ok: false });
        return;
      }
      const issue = room.currentIssueId ? room.issues.get(room.currentIssueId) : null;
      if (!issue) {
        cb?.({ ok: false });
        return;
      }
      issue.revealed = true;
      room.status = "revealed";
      io.to(roomId).emit("room_state", buildRoomState(room));
      cb?.({ ok: true });
    });

    socket.on("next_issue", ({ roomId }: { roomId: string }, cb) => {
      const room = rooms.get(roomId);
      if (!room) {
        cb?.({ ok: false });
        return;
      }
      if (socket.id !== room.hostSocketId) {
        cb?.({ ok: false });
        return;
      }
      const issue = room.currentIssueId ? room.issues.get(room.currentIssueId) : null;
      if (!issue || !issue.revealed) {
        cb?.({ ok: false });
        return;
      }
      room.currentIssueId = null;
      room.status = "idle";
      for (const p of room.participants.values()) p.voted = false;
      io.to(roomId).emit("room_state", buildRoomState(room));
      cb?.({ ok: true });
    });

    socket.on("reopen_voting", ({ roomId }: { roomId: string }, cb) => {
      const room = rooms.get(roomId);
      if (!room) {
        cb?.({ ok: false });
        return;
      }
      if (socket.id !== room.hostSocketId) {
        cb?.({ ok: false });
        return;
      }
      const issue = room.currentIssueId ? room.issues.get(room.currentIssueId) : null;
      if (!issue) {
        cb?.({ ok: false });
        return;
      }
      issue.revealed = false;
      issue.votes.clear();
      room.status = "voting";
      for (const p of room.participants.values()) p.voted = false;
      io.to(roomId).emit("room_state", buildRoomState(room));
      cb?.({ ok: true });
    });

    socket.on("get_room_state", ({ roomId }: { roomId: string }, cb) => {
      const room = rooms.get(roomId);
      if (!room) {
        cb?.({ ok: false });
        return;
      }
      const state = buildRoomState(room);
      const issue = room.currentIssueId ? room.issues.get(room.currentIssueId) : null;
      if (issue) {
        state.myVote = issue.votes.get(socket.id) ?? null;
      }
      cb?.({ ok: true, state });
    });

    socket.on("sync_state", ({ roomId }: { roomId: string }, cb) => {
      const room = rooms.get(roomId);
      if (!room) {
        cb?.({ ok: false });
        return;
      }
      if (room.participants.has(socket.id)) {
        io.to(roomId).emit("room_state", buildRoomState(room));
      }
      cb?.({ ok: true });
    });

    socket.on("set_spectator", ({ roomId, isSpectator }: { roomId: string; isSpectator: boolean }, cb) => {
      const room = rooms.get(roomId);
      if (!room) return;
      const participant = room.participants.get(socket.id);
      if (!participant || !participant.isHost) return;
      participant.isSpectator = isSpectator;
      io.to(roomId).emit("room_state", buildRoomState(room));
      cb?.({ ok: true });
    });

    socket.on("disconnect", () => {
      for (const room of rooms.values()) {
        if (room.participants.has(socket.id)) {
          const isHostLeaving = room.hostSocketId === socket.id;
          room.participants.delete(socket.id);
          
          if (isHostLeaving) {
            const remaining = Array.from(room.participants.values());
            if (remaining.length > 0) {
              for (const p of room.participants.values()) {
                p.isHost = false;
              }
              const newHost = remaining[0];
              newHost.isHost = true;
              room.hostSocketId = newHost.socketId;
              room.hostName = newHost.name;
            } else {
              room.hostSocketId = "";
            }
          }
          
          io.to(room.id).emit("room_state", buildRoomState(room));
        }
      }
    });
  });

  res.end();
}
