import { useCallback, useEffect, useState } from "react";
import { api } from "../api/cliente.js";

const MOTIVOS = [
  ["FUERA_DE_ALCANCE", "Fuera de alcance"],
  ["INFORMACION_INCOMPLETA", "Información incompleta"],
];

export default function Coordinador() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [urgencias, setUrgencias] = useState({});
  const [motivos, setMotivos] = useState({});
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [ocupada, setOcupada] = useState("");

  const cargar = useCallback(async () => {
    try {
      const filas = await api("/solicitudes");
      setSolicitudes(filas.filter((s) => s.estado === "EN_REVISION"));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function ejecutar(solicitud, accion, cuerpo) {
    setOcupada(`${solicitud.id}:${accion}`);
    setError("");
    setMensaje("");
    try {
      await api(`/solicitudes/${encodeURIComponent(solicitud.id)}/${accion}`, { metodo: "POST", cuerpo: { ...cuerpo, versionVista: solicitud.version } });
      setMensaje(`Solicitud ${solicitud.id}: ${accion === "validar" ? "validada" : "rechazada"}.`);
      await cargar();
    } catch (e) {
      setError(e.codigo === "CONFLICTO_VERSION" ? `${e.message}. Actualizando la cola…` : e.message);
      await cargar();
    } finally {
      setOcupada("");
    }
  }

  return (
    <section>
      <h2>Cola de triage</h2>
      <button type="button" onClick={cargar}>Actualizar</button>
      {mensaje ? <p role="status">{mensaje}</p> : null}
      {error ? <p role="alert" style={{ color: "crimson" }}>{error}</p> : null}
      {solicitudes.length === 0 ? <p>No hay solicitudes pendientes de revisión.</p> : (
        <ul>
          {solicitudes.map((solicitud) => (
            <li key={solicitud.id} style={{ margin: "1rem 0" }}>
              <strong>{solicitud.id}</strong> · {solicitud.ubicacionCodigo} · {solicitud.categoria}
              {solicitud.ubicacionVerificada === 0 || solicitud.ubicacionVerificada === false
                ? <p role="note">Ubicación sin verificar; no se puede validar todavía.</p>
                : null}
              <p>{solicitud.descripcion}</p>
              <p>Urgencia sugerida: {solicitud.urgenciaSugerida}</p>
              <label>
                Urgencia confirmada
                <select
                  value={urgencias[solicitud.id] ?? solicitud.urgenciaSugerida}
                  onChange={(e) => setUrgencias((previa) => ({ ...previa, [solicitud.id]: e.target.value }))}
                >
                  {["Crítica", "Alta", "Normal", "Baja"].map((nivel) => <option key={nivel}>{nivel}</option>)}
                </select>
              </label>{" "}
              <button
                type="button"
                disabled={Boolean(ocupada) || solicitud.ubicacionVerificada === 0 || solicitud.ubicacionVerificada === false}
                onClick={() => ejecutar(solicitud, "validar", { urgenciaValidada: urgencias[solicitud.id] ?? solicitud.urgenciaSugerida })}
              >
                {ocupada === `${solicitud.id}:validar` ? "Validando…" : "Validar"}
              </button>{" "}
              <label>
                Motivo de rechazo
                <select
                  value={motivos[solicitud.id] ?? MOTIVOS[0][0]}
                  onChange={(e) => setMotivos((previa) => ({ ...previa, [solicitud.id]: e.target.value }))}
                >
                  {MOTIVOS.map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
                </select>
              </label>{" "}
              <button type="button" disabled={Boolean(ocupada)} onClick={() => ejecutar(solicitud, "rechazar", { motivo: motivos[solicitud.id] ?? MOTIVOS[0][0] })}>
                {ocupada === `${solicitud.id}:rechazar` ? "Rechazando…" : "Rechazar"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
