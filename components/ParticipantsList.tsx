import React from "react";

export default function ParticipantsList({ participants }: { participants: { name: string; voted: boolean; isHost?: boolean }[] }) {
  return (
    <div className="list">
      {participants.map((p, i) => (
        <div key={i} className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span className="pill" style={{ marginRight: 8 }}>{p.isHost ? "Host" : "Membro"}</span>
            <span>{p.name}</span>
          </div>
          <span className="pill" style={{ color: p.voted ? "#22c55e" : "#9ca3af", borderColor: p.voted ? "#22c55e" : "#1f2937" }}>{p.voted ? "Votou" : "Aguardando"}</span>
        </div>
      ))}
    </div>
  );
}
