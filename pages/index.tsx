import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSocket, ensureSocketServer } from "../lib/socket";

export default function Home() {
  const router = useRouter();
  const [adminName, setAdminName] = useState("");
  const [roomName, setRoomName] = useState("");
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
    s.emit("create_room", { hostName: adminName, roomName }, (res: { ok: boolean; roomId?: string; error?: string }) => {
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
      <div className="hero-section">
        <div className="brand">
          <span className="avatar" style={{ width: 44, height: 44, fontSize: 16 }}>VT</span>
          <span className="headline">Votify</span>
        </div>
        <div className="hero-content">
          <h1 className="hero-title">Votação para grandes ideias</h1>
          <p className="hero-subtitle">Ferramenta fácil de usar e divertida para estimativas. 100% gratuita, sem límites, sem cadastro.</p>
          <div className="hero-cta">
            <input 
              className="input" 
              placeholder="Nome da sala" 
              value={roomName} 
              onChange={(e) => setRoomName(e.target.value)} 
              style={{ maxWidth: 240 }}
            />
            <input 
              className="input" 
              placeholder="Seu nome" 
              value={adminName} 
              onChange={(e) => setAdminName(e.target.value)} 
              style={{ maxWidth: 240 }}
            />
            <button className="btn" disabled={!adminName || !roomName || busy} onClick={createRoom}>
              {busy ? "Criando..." : "Criar sala"}
            </button>
          </div>
          {error && <div style={{ color: "var(--danger)", fontSize: 14, marginTop: 8 }}>{error}</div>}
        </div>
      </div>

      <div className="features-section">
        <div className="features-grid">
          <div className="feature-item">
            <div className="feature-icon">🎭</div>
            <h3 className="feature-title">Votação Anônima</h3>
            <p className="feature-desc">Cada participante vota sem ver os outros. Elimine o viés de grupo e alcance consenso real.</p>
          </div>
          <div className="feature-item">
            <div className="feature-icon">⚡</div>
            <h3 className="feature-title">Tempo Real</h3>
            <p className="feature-desc">Todos veem o progresso e resultados instantaneamente. Sem refresh, sem espera.</p>
          </div>
          <div className="feature-item">
            <div className="feature-icon">∞</div>
            <h3 className="feature-title">Sem Limites</h3>
            <p className="feature-desc">Crie quantas salas e rodadas quiser. Sem payerwall, para sempre.</p>
          </div>
          <div className="feature-item">
            <div className="feature-icon">🔗</div>
            <h3 className="feature-title">Compartilhável</h3>
            <p className="feature-desc">Basta enviar o link da sala. Não precisa instalar nada, funciona no navegador.</p>
          </div>
        </div>
      </div>

      <div className="steps-section">
        <h2 className="steps-title">Como funciona</h2>
        <div className="steps-grid">
          <div className="step-item">
            <div className="step-number">1</div>
            <h3 className="step-title">Crie uma sala</h3>
            <p className="step-desc">Inicie uma nova sessão em segundos. Defina o nome do seu time.</p>
          </div>
          <div className="step-item">
            <div className="step-number">2</div>
            <h3 className="step-title">Convide seu time</h3>
            <p className="step-desc">Compartilhe o link da sala com os participantes.</p>
          </div>
          <div className="step-item">
            <div className="step-number">3</div>
            <h3 className="step-title">Vote!</h3>
            <p className="step-desc">Cada um vota anonimamente e vocês veem o resultado juntos.</p>
          </div>
        </div>
      </div>

      <div className="trust-section">
        <p className="trust-text">Usado por times ágeis ao redor do mundo</p>
      </div>

      <footer className="footer">
        <p>Votify © 2025 — 100% gratuito, sempre</p>
      </footer>
    </div>
  );
}