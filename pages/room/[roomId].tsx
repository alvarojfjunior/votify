import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  connectIfNeeded,
  ensureSocketServer,
  getSocket,
  onRoomState,
  offRoomState,
} from "../../lib/socket";
import VotePanel from "../../components/VotePanel";

type Participant = { name: string; isHost: boolean; voted: boolean };
type Vote = { name: string; value: number | string };
type Issue = {
  id: string;
  title: string;
  revealed: boolean;
  votes?: Vote[];
  average?: number;
};

type RoomState = {
  roomId: string;
  status: "idle" | "voting" | "revealed";
  hostName: string;
  hostSocketId: string;
  participants: Participant[];
  currentIssue: Issue | null;
  votedCount: number;
  totalCount: number;
};

export default function Room() {
  const router = useRouter();
  const { roomId } = router.query as { roomId?: string };
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [state, setState] = useState<RoomState | null>(null);
  const [selected, setSelected] = useState<number | string | null>(null);
  const [issueTitle, setIssueTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showAddIssue, setShowAddIssue] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const prevIssueId = useRef<string | null>(null);

  useEffect(() => {
    ensureSocketServer();
    const s = connectIfNeeded();
    const handler = (payload: RoomState) => setState(payload);
    onRoomState(handler);
    if (roomId) {
      s.emit("get_room_state", { roomId }, (res: any) => {
        if (res?.ok) setState(res.state);
      });
    }
    return () => {
      offRoomState(handler);
    };
  }, [roomId]);

  useEffect(() => {
    const s = getSocket();
    if (state?.hostSocketId && s.id && state.hostSocketId === s.id) {
      setJoined(true);
    }
  }, [state?.hostSocketId]);

  useEffect(() => {
    const currentId = state?.currentIssue?.id || null;
    if (
      state?.status === "voting" &&
      currentId &&
      prevIssueId.current !== currentId
    ) {
      setSelected(null);
      prevIssueId.current = currentId;
    }
  }, [state?.status, state?.currentIssue?.id]);

  useEffect(() => {
    if (state?.status === "voting" && state?.currentIssue && !state.currentIssue.revealed) {
      setSelected(null);
    }
  }, [state?.status, state?.currentIssue?.revealed]);

  const inviteLink = useMemo(() => {
    if (!roomId) return "";
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/room/${roomId}`;
  }, [roomId]);

  const currentUserName = useMemo(() => {
    if (!state) return name;
    const socket = getSocket();
    if (socket?.id && state.hostSocketId === socket.id) return state.hostName;
    return name;
  }, [state, name]);

  const join = () => {
    if (!roomId) return;
    const s = getSocket();
    s.emit("join_room", { roomId, name }, (res: any) => {
      if (res?.ok) {
        setJoined(true);
        setState(res.state);
      }
    });
  };

  const createIssue = () => {
    if (!roomId) return;
    const s = getSocket();
    setError(null);
    s.emit("create_issue", { roomId, title: issueTitle }, (res: any) => {
      if (!res?.ok) {
        setError(res?.error || "Falha ao criar issue");
        return;
      }
      setIssueTitle("");
      setShowAddIssue(false);
    });
  };

  const castVote = (v: number | string) => {
    if (!roomId || !state?.currentIssue?.id) return;
    const s = getSocket();
    const numericValue = typeof v === "number" ? v : v === "?" ? -1 : 0;
    setSelected(v);
    s.emit(
      "cast_vote",
      { roomId, issueId: state.currentIssue.id, value: numericValue },
      () => {}
    );
  };

  const reveal = () => {
    if (!roomId) return;
    const s = getSocket();
    s.emit("reveal_votes", { roomId }, () => {});
  };

  const nextIssue = () => {
    if (!roomId) return;
    const s = getSocket();
    setSelected(null);
    s.emit("next_issue", { roomId }, (res: any) => {
      if (!res?.ok) {
        setError(res?.error || "Sem consenso");
      }
    });
  };

  const reopenVoting = () => {
    if (!roomId) return;
    const s = getSocket();
    setError(null);
    setSelected(null);
    s.emit("reopen_voting", { roomId }, () => {});
  };

  const nonHostTotal = state
    ? state.participants.filter((p) => !p.isHost).length
    : 0;
  const nonHostVoted = state
    ? state.participants.filter((p) => !p.isHost && p.voted).length
    : 0;
  const isHost = state?.hostSocketId === getSocket()?.id;

  if (!joined) {
    return (
      <div className="container">
        <div className="card" style={{ maxWidth: 400, margin: "80px auto", textAlign: "center" }}>
          <div className="robot">🤖</div>
          <div className="title" style={{ marginTop: 16 }}>Join Room</div>
          <div className="subtitle" style={{ marginBottom: 24 }}>Enter your name to participate</div>
          <input
            className="input"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ textAlign: "center" }}
          />
          <button className="btn" onClick={join} disabled={!name} style={{ width: "100%", marginTop: 16 }}>
            Join
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <div className="header-left">
          <div className="brand">Votify</div>
        </div>
        <div className="header-right">
          <button className="btn" onClick={() => setShowInvite(true)}>
            👥 Invite players
          </button>
          <button className="menu-btn">⋮</button>
        </div>
      </header>

      {showInvite && (
        <div className="modal-overlay" onClick={() => setShowInvite(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="title">Invite players</span>
              <button className="btn secondary" onClick={() => setShowInvite(false)} style={{ padding: "4px 8px" }}>×</button>
            </div>
            <div className="subtitle" style={{ marginBottom: 16 }}>Share this link with your team</div>
            <input className="input" value={inviteLink} readOnly />
            <button 
              className="btn" 
              style={{ marginTop: 16 }} 
              onClick={() => { 
                navigator.clipboard.writeText(inviteLink); 
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? "✓ Copied!" : "📋 Copy link"}
            </button>
          </div>
        </div>
      )}

      {state && (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div className="col">
                <div className="row" style={{ gap: 8 }}>
                  <span className={`status-badge ${state.status === "idle" ? "idle" : state.status === "voting" ? "voting" : "revealed"}`}>
                    {state.status === "idle" ? "Idle" : state.status === "voting" ? "Voting" : "Results"}
                  </span>
                  <div className="avatar small">{state.hostName.charAt(0)}</div>
                  <span className="subtitle">{state.hostName} (Host)</span>
                </div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                {state.participants.slice(0, 4).map((p, i) => (
                  <div key={i} className="avatar small" title={p.name} style={{ 
                    background: p.voted ? "var(--accent-2)" : "var(--panel-2)",
                    color: p.voted ? "white" : "var(--text-secondary)",
                    border: "2px solid var(--panel)"
                  }}>
                    {p.name.charAt(0)}
                  </div>
                ))}
                {state.participants.length > 4 && (
                  <div className="avatar small" style={{ background: "var(--panel-2)", color: "var(--text-secondary)" }}>
                    +{state.participants.length - 4}
                  </div>
                )}
              </div>
            </div>
          </div>

          {state.status === "idle" && (
            <div className="card" style={{ textAlign: "center", padding: 40 }}>
              <div className="robot" style={{ marginBottom: 16 }}>🤖</div>
              <div className="title">Ready to start</div>
              <div className="subtitle" style={{ marginBottom: 20 }}>Add an issue to begin voting</div>
              {isHost ? (
                !showAddIssue ? (
                  <button className="btn" onClick={() => setShowAddIssue(true)}>+ Add issue</button>
                ) : (
                  <div className="add-issue-form" style={{ maxWidth: 400, margin: "0 auto" }}>
                    <textarea
                      className="input textarea"
                      placeholder="Issue description..."
                      value={issueTitle}
                      onChange={(e) => setIssueTitle(e.target.value)}
                      autoFocus
                    />
                    <div className="add-issue-actions">
                      <button className="btn secondary" onClick={() => { setShowAddIssue(false); setIssueTitle(""); }}>Cancel</button>
                      <button className="btn" onClick={createIssue} disabled={!issueTitle}>Save</button>
                    </div>
                  </div>
                )
              ) : (
                <div className="pill">Waiting for host...</div>
              )}
            </div>
          )}

          {state.status === "voting" && state.currentIssue && (
            <div className="card" style={{ textAlign: "center" }}>
              <div className="row" style={{ justifyContent: "center", gap: 8, marginBottom: 8 }}>
                <span className="issue-id">PP-1</span>
              </div>
              <div className="title" style={{ marginBottom: 24 }}>{state.currentIssue.title}</div>
              <div style={{ fontSize: 24, marginBottom: 24 }}>👇</div>

              <div className="voting-area">
                <VotePanel
                  selected={selected}
                  onVote={castVote}
                  disabled={!!selected}
                />
                <div className="voting-status">
                  {selected ? (
                    <><strong>Vote sent!</strong> · Waiting for others</>
                  ) : (
                    <>No votes · <strong>Voting now...</strong></>
                  )}
                </div>
              </div>

              {isHost && (
                <div style={{ marginTop: 24 }}>
                  <div className="subtitle" style={{ marginBottom: 12 }}>
                    {nonHostVoted} of {nonHostTotal} voted
                  </div>
                  <button
                    className="btn success"
                    onClick={reveal}
                    disabled={nonHostVoted !== nonHostTotal}
                    style={{ minWidth: 180 }}
                  >
                    🔓 Reveal cards
                  </button>
                </div>
              )}
            </div>
          )}

          {state.status === "revealed" && state.currentIssue && (
            <div className="card" style={{ textAlign: "center" }}>
              <div className="row" style={{ justifyContent: "center", gap: 8, marginBottom: 8 }}>
                <span className="issue-id">PP-1</span>
              </div>
              <div className="title" style={{ marginBottom: 24 }}>{state.currentIssue.title}</div>

              <div className="vote-grid" style={{ marginBottom: 24 }}>
                {(state.currentIssue.votes || []).map((v, i) => (
                  <div key={i} className="vote-card active">
                    {v.value === -1 ? "?" : v.value === 0 ? "☕" : v.value}
                  </div>
                ))}
              </div>

              <div className="list" style={{ maxWidth: 300, margin: "0 auto 20px" }}>
                {(state.currentIssue.votes || []).map((v, i) => (
                  <div key={i} className="participant-row" style={{ justifyContent: "space-between" }}>
                    <span className="participant-name">{v.name}</span>
                    <span className="participant-vote">
                      {v.value === -1 ? "?" : v.value === 0 ? "☕" : v.value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="title" style={{ marginBottom: 20 }}>
                Average: {typeof state.currentIssue.average === "number" ? state.currentIssue.average.toFixed(1) : "-"}
              </div>

              {isHost && (
                (() => {
                  const values = (state.currentIssue?.votes || []).map((v) => typeof v.value === "number" ? v.value : -1);
                  const consensus = values.length > 0 && values.every((x) => x === values[0]);
                  return consensus ? (
                    <button className="btn" onClick={nextIssue}>Next issue →</button>
                  ) : (
                    <div className="col" style={{ gap: 12 }}>
                      <div className="pill" style={{ background: "rgba(234,179,8,.2)", color: "#eab308" }}>No consensus</div>
                      <button className="btn secondary" onClick={reopenVoting}>Reopen voting</button>
                    </div>
                  );
                })()
              )}
            </div>
          )}

          <div className="section-header" style={{ marginTop: 24 }}>
            <span className="section-title">Issues</span>
            <span className="section-count">{state.participants.length} participant{state.participants.length !== 1 ? "s" : ""}</span>
          </div>
          {state.currentIssue && (
            <div className="issue-card active">
              <div className="issue-item">
                <div className="issue-number">1</div>
                <div>
                  <div className="issue-id">PP-1</div>
                  <div className="issue-title">{state.currentIssue.title}</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <footer className="footer">
        <div className="footer-links">
          <a href="#">Legal notice</a>
          <a href="#">FAQs</a>
          <a href="/">Home</a>
        </div>
        <button className="btn secondary" style={{ fontSize: 12, padding: "6px 12px" }}>
          Sign out
        </button>
      </footer>
    </div>
  );
}