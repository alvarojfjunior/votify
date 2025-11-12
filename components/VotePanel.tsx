import React from "react";

export default function VotePanel({ selected, onVote, disabled }: { selected: number | null; onVote: (v: number) => void; disabled: boolean }) {
  return (
    <div className="vote-grid">
      {[1, 2, 3, 4, 5].map((v) => (
        <button key={v} className={`vote-card ${selected === v ? "active" : ""}`} onClick={() => onVote(v)} disabled={disabled}>
          {v}
        </button>
      ))}
    </div>
  );
}
