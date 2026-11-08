import { useState } from "react";
import { api, fijarSubject } from "./api/cliente.js";
import Solicitante from "./paginas/Solicitante.jsx";
import Coordinador from "./paginas/Coordinador.jsx";
import Tecnico from "./paginas/Tecnico.jsx";
import Supervisor from "./paginas/Supervisor.jsx";

// Usuarios simulados (deben coincidir con backend/src/adaptadores/identidad.js)
const USUARIOS = [
  ["u-solicitante-1", "Solicitante"],
  ["u-coordinador-1", "Coordinador"],
  ["u-tecnico-1", "Técnico"],
  ["u-supervisor-1", "Supervisor"],
];
const PAGINAS = { Solicitante, Coordinador, Técnico: Tecnico, Supervisor };

export default function App() {
  const [yo, setYo] = useState(null);
  const [error, setError] = useState("");
  const [rol, setRol] = useState("");

  async function entrar(subject, etiqueta) {
    try {
      fijarSubject(subject);
      setYo(await api("/identidad/yo"));
      setRol(etiqueta);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }

  if (!yo) {
    return (
      <main style={{ fontFamily: "sans-serif", maxWidth: 480, margin: "3rem auto" }}>
        <h1>DH-02 · Mantenimiento</h1>
        <p>Identidad simulada: elige un usuario para entrar.</p>
        {USUARIOS.map(([s, e]) => (
          <button key={s} onClick={() => entrar(s, e)} style={{ display: "block", margin: "0.5rem 0" }}>
            Entrar como {e}
          </button>
        ))}
        {error && <p style={{ color: "crimson" }}>{error}</p>}
      </main>
    );
  }

  const Pagina = PAGINAS[rol];
  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 800, margin: "2rem auto" }}>
      <p>
        {yo.nombre} ({rol}) · <button onClick={() => setYo(null)}>Salir</button>
      </p>
      <Pagina />
    </main>
  );
}
