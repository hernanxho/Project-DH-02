import { useCallback, useEffect, useState } from "react";
import { api } from "../api/cliente.js";

const MOTIVOS = [
  ["FUERA_DE_ALCANCE", "Fuera de alcance"],
  ["INFORMACION_INCOMPLETA", "Información incompleta"],
];

export default function Coordinador() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [responsables, setResponsables] = useState([]);
  const [urgencias, setUrgencias] = useState({});
  const [motivos, setMotivos] = useState({});
  const [asignaciones, setAsignaciones] = useState({});
  const [duplicados, setDuplicados] = useState({});
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [ocupada, setOcupada] = useState("");

  const cargar = useCallback(async () => {
    try {
      const [filas, tecnicos] = await Promise.all([
        api("/solicitudes"),
        api("/ordenes/responsables"),
      ]);
      setSolicitudes(filas.filter((s) => s.estado === "EN_REVISION" || (s.estado === "VALIDADA" && !s.ordenId)));
      setResponsables(tecnicos);
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

  async function asignar(solicitud, advertenciaReconocida = false) {
    const responsableSubject = asignaciones[solicitud.id];
    if (!responsableSubject) {
      setError("Selecciona un técnico disponible para crear la orden.");
      return;
    }
    setOcupada(`${solicitud.id}:orden`);
    setError("");
    setMensaje("");
    const cuerpo = { solicitudId: solicitud.id, responsableSubject, versionVista: solicitud.version, advertenciaReconocida };
    try {
      const orden = await api("/ordenes", { metodo: "POST", cuerpo });
      setMensaje(`Orden ${orden.id} creada y asignada a ${orden.responsable.nombre}.`);
      await cargar();
    } catch (e) {
      if (e.codigo === "ADVERTENCIA_REQUIERE_CONFIRMACION" && !advertenciaReconocida) {
        if (window.confirm(`${e.message}\n\n¿Confirmas la asignación?`)) {
          setOcupada("");
          await asignar(solicitud, true);
          return;
        }
      }
      setError(e.message);
      await cargar();
    } finally {
      setOcupada("");
    }
  }

  async function sugerirDuplicados(solicitud) {
    setOcupada(`${solicitud.id}:duplicados`);
    setError("");
    try {
      const resultado = await api(`/solicitudes/${encodeURIComponent(solicitud.id)}/duplicados-sugeridos`);
      setDuplicados((anterior) => ({ ...anterior, [solicitud.id]: resultado.candidatos }));
      if (resultado.candidatos.length === 0) setMensaje(`No se encontraron posibles duplicados para ${solicitud.id}.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupada("");
    }
  }

  async function vincularDuplicado(solicitud, maestraId) {
    setOcupada(`${solicitud.id}:vincular`);
    setError("");
    try {
      await api(`/solicitudes/${encodeURIComponent(solicitud.id)}/vincular-duplicado`, {
        metodo: "POST",
        cuerpo: { maestraId, versionVista: solicitud.version },
      });
      setMensaje(`${solicitud.id} quedó vinculada a ${maestraId}.`);
      await cargar();
    } catch (e) {
      setError(e.message);
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
              {solicitud.estado === "EN_REVISION" ? (
                <>
                  <p>Urgencia sugerida: {solicitud.urgenciaSugerida}</p>
                  <button type="button" disabled={Boolean(ocupada)} onClick={() => sugerirDuplicados(solicitud)}>
                    {ocupada === `${solicitud.id}:duplicados` ? "Buscando…" : "Sugerir duplicados"}
                  </button>
                  {duplicados[solicitud.id] ? (
                    duplicados[solicitud.id].length === 0 ? <p>No hay candidatos en la ventana configurada.</p> : (
                      <ul>
                        {duplicados[solicitud.id].map((candidato) => (
                          <li key={candidato.id}>
                            {candidato.id} · {candidato.categoria} · {candidato.estado}
                            {candidato.mismaCategoria ? " · misma categoría" : " · categoría distinta"}{" "}
                            <button type="button" disabled={Boolean(ocupada)} onClick={() => vincularDuplicado(solicitud, candidato.id)}>
                              Vincular como duplicado
                            </button>
                          </li>
                        ))}
                      </ul>
                    )
                  ) : null}
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
                </>
              ) : (
                <>
                  <p>Validada · Urgencia: {solicitud.urgenciaValidada}</p>
                  <label>
                    Asignar a
                    <select
                      value={asignaciones[solicitud.id] ?? ""}
                      onChange={(e) => setAsignaciones((previa) => ({ ...previa, [solicitud.id]: e.target.value }))}
                    >
                      <option value="">Selecciona técnico</option>
                      {responsables.map((persona) => (
                        <option key={persona.subject} value={persona.subject}>{persona.nombre} · {persona.unidad}</option>
                      ))}
                    </select>
                  </label>{" "}
                  <button type="button" disabled={Boolean(ocupada) || responsables.length === 0} onClick={() => asignar(solicitud)}>
                    {ocupada === `${solicitud.id}:orden` ? "Creando orden…" : "Crear orden"}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
