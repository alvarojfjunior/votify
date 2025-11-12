import type { NextApiRequest, NextApiResponse } from "next";
import { Server as IOServer } from "socket.io";
import { randomUUID } from "crypto";

type Participant = {
  socketId: string;
  name: string;
  isHost: boolean;
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
  hostSocketId: string;
  hostName: string;
  participants: Map<string, Participant>;
  issues: Map<string, Issue>;
  currentIssueId: string | null;
  status: "idle" | "voting" | "revealed";
};

const g: any = globalThis as any;
const rooms: Map<string, Room> = g.__votify_rooms || new Map();
if (!g.__votify_rooms) g.__votify_rooms = rooms;

function buildRoomState(room: Room) {
  const participants = Array.from(room.participants.values()).map((p) => ({
    name: p.name,
    isHost: p.isHost,
    voted: p.voted,
  }));
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
    status: room.status,
    hostName: room.hostName,
    hostSocketId: room.hostSocketId,
    participants,
    currentIssue,
    votedCount,
    totalCount,
  };
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if ((res.socket as any).server.io) {
    res.end();
    return;
  }
  const io = new IOServer((res.socket as any).server, { path: "/api/socket_io" });
  (res.socket as any).server.io = io;

  io.on("connection", (socket) => {
    socket.on("create_room", ({ hostName }: { hostName: string }, cb) => {
      const id = randomUUID();
      const room: Room = {
        id,
        hostSocketId: socket.id,
        hostName: hostName || "Host",
        participants: new Map(),
        issues: new Map(),
        currentIssueId: null,
        status: "idle",
      };
      room.participants.set(socket.id, { socketId: socket.id, name: room.hostName, isHost: true, voted: false });
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
      room.participants.set(socket.id, { socketId: socket.id, name: name || "Convidado", isHost: false, voted: false });
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
      if (value < 1 || value > 5) {
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
      const nonHostTotal = Array.from(room.participants.values()).filter((p) => !p.isHost).length;
      const votesArray = Array.from(issue.votes.values());
      const hasAllVotes = votesArray.length === nonHostTotal && nonHostTotal > 0;
      const consensus = hasAllVotes && votesArray.every((v) => v === votesArray[0]);
      if (!consensus) {
        cb?.({ ok: false, error: "Sem consenso" });
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
      cb?.({ ok: true, state: buildRoomState(room) });
    });

    socket.on("disconnect", () => {
      for (const room of rooms.values()) {
        if (room.participants.has(socket.id)) {
          room.participants.delete(socket.id);
          if (room.hostSocketId === socket.id) {
            const newHost = Array.from(room.participants.values())[0];
            if (newHost) {
              room.hostSocketId = newHost.socketId;
              room.hostName = newHost.name;
              newHost.isHost = true;
            }
          }
          io.to(room.id).emit("room_state", buildRoomState(room));
        }
      }
    });
  });

  res.end();
}
