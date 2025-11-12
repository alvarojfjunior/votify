import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  connectIfNeeded,
  ensureSocketServer,
  getSocket,
  onRoomState,
  offRoomState,
} from "../../lib/socket";
import ParticipantsList from "../../components/ParticipantsList";
import VotePanel from "../../components/VotePanel";

type RoomState = {
  roomId: string;
  status: "idle" | "voting" | "revealed";
  hostName: string;
  participants: { name: string; isHost: boolean; voted: boolean }[];
  currentIssue: {
    id: string;
    title: string;
    revealed: boolean;
    votes?: { name: string; value: number }[];
    average?: number;
  } | null;
  votedCount: number;
  totalCount: number;
};

export default function Room() {
  const router = useRouter();
  const { roomId } = router.query as { roomId?: string };
  const isHost = router.query.host === "1";
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [state, setState] = useState<RoomState | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [issueTitle, setIssueTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
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
    if (isHost) setJoined(true);
    return () => {
      offRoomState(handler);
    };
  }, [roomId, isHost]);

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

  const inviteLink = useMemo(() => {
    if (!roomId) return "";
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/room/${roomId}`;
  }, [roomId]);

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
    });
  };

  const castVote = (v: number) => {
    if (!roomId || !state?.currentIssue?.id) return;
    const s = getSocket();
    setSelected(v);
    s.emit(
      "cast_vote",
      { roomId, issueId: state.currentIssue.id, value: v },
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
    s.emit("next_issue", { roomId }, () => {});
  };

  const nonHostTotal = state
    ? state.participants.filter((p) => !p.isHost).length
    : 0;
  const nonHostVoted = state
    ? state.participants.filter((p) => !p.isHost && p.voted).length
    : 0;

  return (
    <div className="container grid" style={{ marginTop: 24 }}>
      <div className="card col">
        <div className="header">
          <div className="brand">
            <span
              className="avatar"
              style={{ width: 36, height: 36, fontSize: 13 }}
            >
              VT
            </span>
          </div>
          {state && (
            <span className="pill">
              {state.status === "idle"
                ? "Ociosa"
                : state.status === "voting"
                ? "Votando"
                : "Resultados"}
            </span>
          )}
        </div>
        <div className="subtitle">Convide pelo link: {inviteLink}</div>
        <div className="separator" />
        {state && <ParticipantsList participants={state.participants} />}
      </div>
      <div className="card col">
        {!joined && (
          <>
            <div className="title">Quem é você?</div>
            <input
              className="input"
              placeholder="Digite seu nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="btn" onClick={join} disabled={!name}>
              Entrar na sala
            </button>
          </>
        )}

        {joined && state?.status === "idle" && (
          <>
            <div className="title">Sessão pronta para começar</div>
            {isHost ? (
              <>
                <div className="subtitle">
                  Crie uma issue para iniciar a rodada de votos
                </div>
                <input
                  className="input"
                  placeholder="Título da issue"
                  value={issueTitle}
                  onChange={(e) => setIssueTitle(e.target.value)}
                />
                <button
                  className="btn"
                  onClick={createIssue}
                  disabled={!issueTitle}
                >
                  Criar issue
                </button>
                {error && (
                  <div style={{ color: "#ef4444", fontSize: 14 }}>{error}</div>
                )}
              </>
            ) : (
              <div className="subtitle">Aguardando o host iniciar a rodada</div>
            )}
          </>
        )}

        {joined && state?.status === "voting" && state.currentIssue && (
          <>
            <div className="title">Rodada: {state.currentIssue.title}</div>
            {!isHost ? (
              <>
                <div className="subtitle">Escolha uma carta de 1 a 5</div>
                <VotePanel
                  selected={selected}
                  onVote={castVote}
                  disabled={!!selected}
                />
                {selected && (
                  <span
                    className="pill"
                    style={{ color: "#22c55e", borderColor: "#22c55e" }}
                  >
                    Voto enviado
                  </span>
                )}
              </>
            ) : (
              <>
                <div className="subtitle">
                  Progresso: {nonHostVoted}/{nonHostTotal} prontos
                </div>
                <button
                  className="btn success"
                  onClick={reveal}
                  disabled={nonHostVoted !== nonHostTotal}
                >
                  Revelar cartas
                </button>
              </>
            )}
          </>
        )}

        {joined && state?.status === "revealed" && state.currentIssue && (
          <>
            <div className="title">Resultados: {state.currentIssue.title}</div>
            <div className="list">
              {(state.currentIssue.votes || []).map((v, i) => (
                <div
                  key={i}
                  className="row"
                  style={{ justifyContent: "space-between" }}
                >
                  <span>{v.name}</span>
                  <span className="pill" style={{ fontWeight: 700 }}>
                    {v.value}
                  </span>
                </div>
              ))}
            </div>
            <div className="subtitle">
              Média:{" "}
              {typeof state.currentIssue.average === "number"
                ? state.currentIssue.average
                : "-"}
            </div>
            {isHost ? (
              <button className="btn" onClick={nextIssue}>
                Próxima issue
              </button>
            ) : (
              <span className="pill">Aguardando a próxima issue</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
