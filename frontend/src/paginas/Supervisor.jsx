import { useCallback, useEffect, useState } from "react";
import { api } from "../api/cliente.js";

export default function Supervisor() {
  const [tablero, setTablero] = useState(null);
  const [responsables, setResponsables] = useState([]);
  const [reasignaciones, setReasignaciones] = useState({});
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [ocupada, setOcupada] = useState("");

  const cargar = useCallback(async () => {
    try {
      const [datos, tecnicos] = await Promise.all([api("/reportes/tablero"), api("/ordenes/responsables")]);
      setTablero(datos);
      setResponsables(tecnicos);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function reasignar(orden, advertenciaReconocida = false) {
    const datos = reasignaciones[orden.id] ?? {};
    if (!datos.responsableSubject || !datos.motivo?.trim()) {
      setError("Selecciona un responsable nuevo e indica el motivo de la reasignación.");
      return;
    }
    setOcupada(orden.id);
    setError("");
    setMensaje("");
    try {
      await api(`/ordenes/${encodeURIComponent(orden.id)}/reasignaciones`, {
        metodo: "POST",
        cuerpo: {
          responsableSubject: datos.responsableSubject,
          motivo: datos.motivo,
          versionVista: orden.version,
          advertenciaReconocida,
        },
      });
      setMensaje(`La orden ${orden.id} fue reasignada.`);
      await cargar();
    } catch (e) {
      if (e.codigo === "ADVERTENCIA_REQUIERE_CONFIRMACION" && !advertenciaReconocida && window.confirm(`${e.message}\n\n¿Confirmas la reasignación?`)) {
        setOcupada("");
        await reasignar(orden, true);
        return;
      }
      setError(e.message);
      await cargar();
    } finally {
      setOcupada("");
    }
  }

  function cambiar(ordenId, campo, valor) {
    setReasignaciones((anterior) => ({ ...anterior, [ordenId]: { ...anterior[ordenId], [campo]: valor } }));
  }

  return (
    <section>
      <h2>Tablero operativo</h2>
      <button type="button" onClick={cargar}>Actualizar</button>
      {mensaje ? <p role="status">{mensaje}</p> : null}
      {error ? <p role="alert" style={{ color: "crimson" }}>{error}</p> : null}
      {!tablero ? <p>Cargando tablero…</p> : (
        <>
          <p>Alerta por falta de atención: {tablero.umbralSinAtencionHoras} horas.</p>
          <h3>Órdenes atrasadas ({tablero.atrasadas.length})</h3>
          {tablero.atrasadas.length === 0 ? <p>No hay órdenes atrasadas.</p> : (
            <ul>
              {tablero.atrasadas.map((orden) => (
                <li key={orden.id} style={{ margin: "1rem 0" }}>
                  <strong>{orden.id}</strong> · {orden.estado} · {orden.prioridad} · {orden.ubicacionCodigo}
                  <p>{Math.floor(orden.minutosSinAtencion / 60)} h sin atención · responsable {orden.responsableSubject}</p>
                  <label>
                    Reasignar a
                    <select value={reasignaciones[orden.id]?.responsableSubject ?? ""} onChange={(e) => cambiar(orden.id, "responsableSubject", e.target.value)}>
                      <option value="">Selecciona responsable</option>
                      {responsables.filter((r) => r.subject !== orden.responsableSubject).map((persona) => (
                        <option key={persona.subject} value={persona.subject}>{persona.nombre} · {persona.unidad}</option>
                      ))}
                    </select>
                  </label>{" "}
                  <label>
                    Motivo
                    <input required value={reasignaciones[orden.id]?.motivo ?? ""} onChange={(e) => cambiar(orden.id, "motivo", e.target.value)} />
                  </label>{" "}
                  <button type="button" disabled={ocupada === orden.id} onClick={() => reasignar(orden)}>
                    {ocupada === orden.id ? "Reasignando…" : "Reasignar"}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <h3>Bloqueos abiertos ({tablero.bloqueos.length})</h3>
          {tablero.bloqueos.length === 0 ? <p>No hay bloqueos abiertos.</p> : (
            <ul>{tablero.bloqueos.map((b) => <li key={b.id}>{b.ordenId} · {b.causal} · {b.ubicacionCodigo} · seguimiento {b.seguimientoEn ? new Date(b.seguimientoEn).toLocaleString() : "sin fecha"}</li>)}</ul>
          )}
          <h3>Carga por técnico</h3>
          {tablero.cargaTecnicos.length === 0 ? <p>No hay perfiles técnicos cargados.</p> : (
            <ul>{tablero.cargaTecnicos.map((t) => <li key={t.subject}>{t.nombre} · {t.unidad}: {t.ordenesActivas} órdenes activas</li>)}</ul>
          )}
          <h3>Ubicaciones críticas</h3>
          {tablero.ubicacionesCriticas.length === 0 ? <p>No hay ubicaciones que cumplan los criterios configurados.</p> : (
            <ul>{tablero.ubicacionesCriticas.map((u) => <li key={u.codigo}>{u.codigo} · {u.ordenesActivas} órdenes activas · {u.ordenesCriticas} Críticas {u.restringida ? "· restringida" : ""}</li>)}</ul>
          )}
        </>
      )}
    </section>
  );
}
