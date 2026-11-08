import { useCallback, useEffect, useState } from "react";
import { api } from "../api/cliente.js";

const inicial = { ubicacionCodigo: "", categoria: "", descripcion: "", urgenciaSugerida: "Normal" };

export default function Solicitante() {
  const [formulario, setFormulario] = useState(inicial);
  const [solicitudes, setSolicitudes] = useState([]);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setSolicitudes(await api("/solicitudes"));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  function cambiar(campo, valor) {
    setFormulario((anterior) => ({ ...anterior, [campo]: valor }));
  }

  async function enviar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      const creada = await api("/solicitudes", { metodo: "POST", cuerpo: formulario });
      setMensaje(`Solicitud ${creada.id} registrada para revisión.`);
      setFormulario(inicial);
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section>
      <h2>Reportar un problema</h2>
      <form onSubmit={enviar} style={{ display: "grid", gap: "0.75rem", maxWidth: 560 }}>
        <label>
          Código de ubicación
          <input required maxLength={64} value={formulario.ubicacionCodigo} onChange={(e) => cambiar("ubicacionCodigo", e.target.value)} placeholder="Por ejemplo, A-101" />
        </label>
        <label>
          Categoría
          <input required maxLength={64} value={formulario.categoria} onChange={(e) => cambiar("categoria", e.target.value)} />
        </label>
        <label>
          Descripción
          <textarea required maxLength={4000} rows={4} value={formulario.descripcion} onChange={(e) => cambiar("descripcion", e.target.value)} />
        </label>
        <label>
          Urgencia sugerida
          <select value={formulario.urgenciaSugerida} onChange={(e) => cambiar("urgenciaSugerida", e.target.value)}>
            {["Crítica", "Alta", "Normal", "Baja"].map((nivel) => <option key={nivel}>{nivel}</option>)}
          </select>
        </label>
        <button type="submit" disabled={guardando}>{guardando ? "Enviando…" : "Enviar solicitud"}</button>
      </form>
      <p role="status">{mensaje}</p>
      {error ? <p role="alert" style={{ color: "crimson" }}>{error}</p> : null}

      <h2>Mis solicitudes</h2>
      {solicitudes.length === 0 ? <p>Aún no tienes solicitudes.</p> : (
        <ul>
          {solicitudes.map((solicitud) => (
            <li key={solicitud.id}>
              <strong>{solicitud.id}</strong> · {solicitud.estado} · {solicitud.categoria} · {solicitud.ubicacionCodigo}
              {solicitud.estadoOrden ? <span> · Orden: {solicitud.estadoOrden}{solicitud.tipoCierre ? ` (${solicitud.tipoCierre})` : ""}</span> : null}
              <p>{solicitud.descripcion}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
