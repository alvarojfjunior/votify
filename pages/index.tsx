import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSocket, ensureSocketServer } from "../lib/socket";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureSocketServer();
    const s = getSocket();
    if (!s.connected) s.connect();
    return () => {
      s.off("connect_error");
    };
  }, []);

  const createRoom = () => {
    setBusy(true);
    setError(null);
    const s = getSocket();
    s.emit("create_room", { hostName: name }, (res: { ok: boolean; roomId?: string; error?: string }) => {
      setBusy(false);
      if (!res.ok || !res.roomId) {
        setError(res.error || "Falha ao criar sala");
        return;
      }
      router.push(`/room/${res.roomId}?host=1`);
    });
  };

  return (
    <div className="container">
      <div className="card col" style={{ maxWidth: 680, margin: "80px auto", textAlign: "center" }}>
        <div className="brand">
          <span className="avatar" style={{ width: 40, height: 40, fontSize: 14 }}>VT</span>
          <span className="headline">Votify</span>
        </div>
        <div className="hero">
          <div className="subtitle">Votação em grupo, rápida e elegante. Crie uma sala, convide a equipe e decida com clareza.</div>
        </div>
        <div className="row" style={{ marginTop: 18 }}>
          <input className="input" placeholder="Digite seu nome" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn" disabled={!name || busy} onClick={createRoom}>{busy ? "Criando..." : "Criar sala"}</button>
        </div>
        {error && <div style={{ color: "#ef4444", fontSize: 14, marginTop: 8 }}>{error}</div>}
      </div>
    </div>
  );
}
