import React from "react";

function initials(name: string) {
  const parts = name.trim().split(" ");
  const a = parts[0]?.[0] || "?";
  const b = parts.length > 1 ? parts[1]?.[0] || "" : "";
  return (a + b).toUpperCase();
}

export default function ParticipantsList({ participants }: { participants: { name: string; voted: boolean; isHost?: boolean }[] }) {
  return (
    <div className="list">
      {participants.map((p, i) => (
        <div key={i} className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
          <div className="row" style={{ alignItems: "center" }}>
            <span className="avatar" style={{ marginRight: 10 }}>{initials(p.name)}</span>
            <div className="col" style={{ gap: 4 }}>
              <div style={{ fontWeight: 700 }}>{p.name}</div>
              <div className="badge">
                <span className="pill" style={{ marginRight: 8 }}>{p.isHost ? "Host" : "Membro"}</span>
                <span className="row" style={{ alignItems: "center", gap: 8 }}>
                  <span className="status-dot" style={{ background: p.voted ? "#22c55e" : "#9ca3af" }}></span>
                  <span className="subtitle">{p.voted ? "Votou" : "Aguardando"}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
