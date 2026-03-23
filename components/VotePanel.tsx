import React from "react";

const CARD_VALUES = [0, 1, 2, 3, 5];

interface VotePanelProps {
  selected: number | string | null;
  onVote: (v: number | string) => void;
  disabled: boolean;
  revealed?: boolean;
  showCards?: boolean;
}

export default function VotePanel({ selected, onVote, disabled, revealed, showCards }: VotePanelProps) {
  return (
    <div className="vote-grid">
      {CARD_VALUES.map((v, i) => {
        const isSelected = selected === v;
        const isHidden = !revealed && !showCards && !isSelected;
        
        return (
          <button
            key={i}
            className={`vote-card ${isSelected ? "active" : ""} ${isHidden ? "hidden" : ""}`}
            onClick={() => onVote(v)}
            disabled={disabled}
            aria-pressed={isSelected}
          >
            {isHidden ? "" : v}
          </button>
        );
      })}
    </div>
  );
}