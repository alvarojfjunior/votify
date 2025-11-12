import React from "react";

export default function VotePanel({ selected, onVote, disabled }: { selected: number | null; onVote: (v: number) => void; disabled: boolean }) {
  return (
    <div className="vote-grid">
      {[1, 2, 3, 4, 5].map((v) => (
        <button
          key={v}
          className={`vote-card ${selected === v ? "active" : ""}`}
          onClick={() => onVote(v)}
          disabled={disabled}
          aria-pressed={selected === v}
        >
          <span className="vote-value">{v}</span>
          {selected === v && <span className="vote-check">✓</span>}
        </button>
      ))}
    </div>
  );
}
