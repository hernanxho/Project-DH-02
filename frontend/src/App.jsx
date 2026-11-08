import { useState } from "react";
import { api, fijarSubject } from "./api/cliente.js";
import Solicitante from "./paginas/Solicitante.jsx";
import Coordinador from "./paginas/Coordinador.jsx";
import Tecnico from "./paginas/Tecnico.jsx";
import Supervisor from "./paginas/Supervisor.jsx";
import Representante from "./paginas/Representante.jsx";
import Notificaciones from "./componentes/Notificaciones.jsx";

// Usuarios activos del pack y página de demostración asociada a su rol principal.
const USUARIOS = [
  ["HU-STU-2001", "Samuel Rios · Solicitante", "Solicitante"],
  ["HU-FAC-2101", "Paula Mendez · Solicitante", "Solicitante"],
  ["HU-EMP-2201", "Luis Herrera · Coordinación", "Coordinador"],
  ["HU-EMP-2202", "Ricardo Torres · Supervisión", "Supervisor"],
  ["HU-EMP-2203", "Ana Sofia Ramirez · Representante de laboratorio", "Representante"],
  ["SEC-ONCALL", "Seguridad del campus", "Solicitante"],
  ["TECH-001", "Jorge Salcedo · Electricidad", "Técnico"],
  ["TECH-002", "Mariana Ibarra · Plomería", "Técnico"],
  ["TECH-003", "Carlos Vega · HVAC", "Técnico"],
  ["TECH-004", "Luisa Andrade · Mantenimiento general", "Técnico"],
  ["TECH-005", "Pedro Navarro · No disponible", "Técnico"],
  ["TECH-006", "Rosa Molina · Zonas exteriores", "Técnico"],
];
const PAGINAS = { Solicitante, Coordinador, Técnico: Tecnico, Supervisor, Representante };

export default function App() {
  const [yo, setYo] = useState(null);
  const [error, setError] = useState("");
  const [rol, setRol] = useState("");
  const [etiqueta, setEtiqueta] = useState("");

  async function entrar(subject, nombreVisible, pagina) {
    try {
      fijarSubject(subject);
      setYo(await api("/identidad/yo"));
      setRol(pagina);
      setEtiqueta(nombreVisible);
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
        {USUARIOS.map(([s, e, pagina]) => (
          <button key={s} onClick={() => entrar(s, e, pagina)} style={{ display: "block", margin: "0.5rem 0" }}>
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
        {yo.nombre} · {etiqueta} · <button onClick={() => setYo(null)}>Salir</button>
      </p>
      <Notificaciones />
      <Pagina />
    </main>
  );
}
