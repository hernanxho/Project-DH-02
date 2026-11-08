import { useCallback, useEffect, useState } from "react";
import { api } from "../api/cliente.js";

const ESTADOS = ["ASIGNADA", "EN_PROGRESO", "BLOQUEADA_MATERIALES", "BLOQUEADA_ACCESO", "RESUELTA", "CERRADA"];

export default function Tecnico() {
  const [ordenes, setOrdenes] = useState([]);
  const [responsables, setResponsables] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroUbicacion, setFiltroUbicacion] = useState("");
  const [filtroPrioridad, setFiltroPrioridad] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [ocupada, setOcupada] = useState("");
  const [observaciones, setObservaciones] = useState({});
  const [fotos, setFotos] = useState({});
  const [bloqueos, setBloqueos] = useState({});
  const [transferencias, setTransferencias] = useState({});
  const [materiales, setMateriales] = useState({});

  const cargar = useCallback(async () => {
    const parametros = new URLSearchParams();
    if (filtroEstado) parametros.set("estado", filtroEstado);
    if (filtroUbicacion.trim()) parametros.set("ubicacion", filtroUbicacion.trim());
    if (filtroPrioridad) parametros.set("prioridad", filtroPrioridad);
    const queryString = parametros.toString();
    const query = queryString ? `?${queryString}` : "";
    try {
      const [lista, personas] = await Promise.all([
        api(`/ordenes${query}`),
        api("/ordenes/responsables"),
      ]);
      setOrdenes(lista);
      setResponsables(personas);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, [filtroEstado, filtroPrioridad, filtroUbicacion]);

  useEffect(() => { cargar(); }, [cargar]);

  function leerBase64(archivo) {
    return new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(String(lector.result).split(",")[1] ?? "");
      lector.onerror = () => reject(new Error("No se pudo leer la imagen"));
      lector.readAsDataURL(archivo);
    });
  }

  async function subirFoto(archivo) {
    if (!archivo) return [];
    const contenidoBase64 = await leerBase64(archivo);
    const respuesta = await api("/adjuntos", {
      metodo: "POST",
      cuerpo: { nombreArchivo: archivo.name, mimeType: archivo.type, contenidoBase64 },
    });
    return [respuesta.id];
  }

  async function registrarEvidencia(orden, hacia) {
    const resumen = observaciones[orden.id]?.trim();
    if (!resumen) {
      setError("Escribe una observación para registrar como evidencia.");
      return;
    }
    setOcupada(orden.id);
    setError("");
    setMensaje("");
    try {
      const adjuntoIds = await subirFoto(fotos[orden.id]);
      await api(`/ejecucion/${encodeURIComponent(orden.id)}/evidencias`, {
        metodo: "POST",
        cuerpo: { tipo: "observacion", resumen, adjuntoIds, hacia, versionVista: orden.version },
      });
      setMensaje(`Orden ${orden.id}: estado actualizado a ${hacia}.`);
      await cargar();
    } catch (e) {
      setError(e.message);
      await cargar();
    } finally {
      setOcupada("");
    }
  }

  async function registrarBloqueo(orden) {
    const datos = bloqueos[orden.id] ?? {};
    if (!datos.parteResponsable?.trim() || !datos.siguienteAccion?.trim() || !datos.seguimientoEn || !observaciones[orden.id]?.trim()) {
      setError("Completa la evidencia, la parte responsable, la siguiente acción y la fecha de seguimiento del bloqueo.");
      return;
    }
    setOcupada(orden.id);
    setError("");
    setMensaje("");
    try {
      const seguimientoEn = new Date(datos.seguimientoEn).toISOString();
      const adjuntoIds = await subirFoto(fotos[orden.id]);
      const resultado = await api(`/ejecucion/${encodeURIComponent(orden.id)}/bloqueos`, {
        metodo: "POST",
        cuerpo: {
          causal: datos.causal ?? "MATERIALES",
          parteResponsable: datos.parteResponsable,
          siguienteAccion: datos.siguienteAccion,
          seguimientoEn,
          resumen: observaciones[orden.id],
          adjuntoIds,
          versionVista: orden.version,
        },
      });
      setMensaje(`Orden ${orden.id} bloqueada. Seguimiento: ${resultado.bloqueoId}.`);
      await cargar();
    } catch (e) {
      setError(e.message);
      await cargar();
    } finally {
      setOcupada("");
    }
  }

  async function registrarMaterial(orden) {
    const datos = materiales[orden.id] ?? {};
    if (!datos.descripcion?.trim() || !datos.cantidad || !datos.unidad?.trim()) {
      setError("Completa la descripción, cantidad y unidad del material.");
      return;
    }
    setOcupada(orden.id);
    setError("");
    setMensaje("");
    try {
      await api(`/ejecucion/${encodeURIComponent(orden.id)}/materiales`, {
        metodo: "POST",
        cuerpo: {
          codigo: datos.codigo?.trim() || undefined,
          descripcion: datos.descripcion,
          cantidad: Number(datos.cantidad),
          unidad: datos.unidad,
          costoUnitarioEstimado: datos.costo ? Number(datos.costo) : undefined,
          requiereCompra: Boolean(datos.requiereCompra),
        },
      });
      setMensaje(`Material registrado en la orden ${orden.id}.`);
      setMateriales((anterior) => ({ ...anterior, [orden.id]: {} }));
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupada("");
    }
  }

  function cambiarMaterial(ordenId, campo, valor) {
    setMateriales((anterior) => ({
      ...anterior,
      [ordenId]: { ...anterior[ordenId], [campo]: valor },
    }));
  }

  async function reanudar(orden) {
    setOcupada(orden.id);
    setError("");
    setMensaje("");
    try {
      await api(`/ordenes/${encodeURIComponent(orden.id)}/transiciones`, {
        metodo: "POST",
        cuerpo: { hacia: "EN_PROGRESO", versionVista: orden.version },
      });
      setMensaje(`Orden ${orden.id}: trabajo reanudado.`);
      await cargar();
    } catch (e) {
      setError(e.message);
      await cargar();
    } finally {
      setOcupada("");
    }
  }

  function cambiarBloqueo(ordenId, campo, valor) {
    setBloqueos((anterior) => ({
      ...anterior,
      [ordenId]: { ...anterior[ordenId], [campo]: valor },
    }));
  }

  async function transferir(orden, advertenciaReconocida = false) {
    const datos = transferencias[orden.id] ?? {};
    if (!datos.responsableSubject || !datos.motivo?.trim()) {
      setError("Selecciona un nuevo responsable e indica el motivo de la transferencia.");
      return;
    }
    setOcupada(orden.id);
    setError("");
    setMensaje("");
    try {
      await api(`/ordenes/${encodeURIComponent(orden.id)}/transferencias`, {
        metodo: "POST",
        cuerpo: {
          responsableSubject: datos.responsableSubject,
          motivo: datos.motivo,
          versionVista: orden.version,
          advertenciaReconocida,
        },
      });
      setMensaje(`La orden ${orden.id} fue transferida.`);
      await cargar();
    } catch (e) {
      if (e.codigo === "ADVERTENCIA_REQUIERE_CONFIRMACION" && !advertenciaReconocida && window.confirm(`${e.message}\n\n¿Confirmas la transferencia?`)) {
        setOcupada("");
        await transferir(orden, true);
        return;
      }
      setError(e.message);
      await cargar();
    } finally {
      setOcupada("");
    }
  }

  function cambiarTransferencia(ordenId, campo, valor) {
    setTransferencias((anterior) => ({
      ...anterior,
      [ordenId]: { ...anterior[ordenId], [campo]: valor },
    }));
  }

  return (
    <section>
      <h2>Mis órdenes</h2>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <label>
          Estado
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="">Todos</option>
            {ESTADOS.map((estado) => <option key={estado}>{estado}</option>)}
          </select>
        </label>
        <label>
          Ubicación
          <input value={filtroUbicacion} onChange={(e) => setFiltroUbicacion(e.target.value)} placeholder="Código exacto" />
        </label>
        <label>
          Prioridad
          <select value={filtroPrioridad} onChange={(e) => setFiltroPrioridad(e.target.value)}>
            <option value="">Todas</option>
            {["Crítica", "Alta", "Normal", "Baja"].map((prioridad) => <option key={prioridad}>{prioridad}</option>)}
          </select>
        </label>
        <button type="button" onClick={cargar}>Actualizar</button>
      </div>
      {mensaje ? <p role="status">{mensaje}</p> : null}
      {error ? <p role="alert" style={{ color: "crimson" }}>{error}</p> : null}
      {ordenes.length === 0 ? <p>No tienes órdenes que coincidan con esos filtros.</p> : (
        <ul>
          {ordenes.map((orden) => (
            <li key={orden.id} style={{ margin: "1rem 0" }}>
              <strong>{orden.id}</strong> · {orden.estado} · prioridad {orden.prioridad}
              <p>{orden.ubicacionCodigo} · {orden.categoria}</p>
              <p>{orden.descripcion}</p>
              {orden.estado === "ASIGNADA" || orden.estado === "EN_PROGRESO" ? (
                <label>
                  Observación de ejecución
                  <textarea
                    rows={2}
                    maxLength={4000}
                    value={observaciones[orden.id] ?? ""}
                    onChange={(e) => setObservaciones((anterior) => ({ ...anterior, [orden.id]: e.target.value }))}
                  />
                </label>
              ) : null}
              {orden.estado === "ASIGNADA" || orden.estado === "EN_PROGRESO" ? (
                <label>
                  Foto de evidencia (opcional, JPEG/PNG/WebP; hasta 5 MB)
                  <input key={fotos[orden.id]?.name ?? `${orden.id}-sin-foto`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFotos((anterior) => ({ ...anterior, [orden.id]: e.target.files?.[0] ?? null }))} />
                </label>
              ) : null}
              {orden.estado === "ASIGNADA" ? (
                <button type="button" disabled={ocupada === orden.id} onClick={() => registrarEvidencia(orden, "EN_PROGRESO")}>
                  {ocupada === orden.id ? "Guardando…" : "Iniciar trabajo"}
                </button>
              ) : null}
              {orden.estado === "EN_PROGRESO" ? (
                <>
                  <fieldset>
                    <legend>Material usado o requerido</legend>
                    <label>Código (opcional)<input value={materiales[orden.id]?.codigo ?? ""} onChange={(e) => cambiarMaterial(orden.id, "codigo", e.target.value)} /></label>
                    <label>Descripción<input value={materiales[orden.id]?.descripcion ?? ""} onChange={(e) => cambiarMaterial(orden.id, "descripcion", e.target.value)} /></label>
                    <label>Cantidad<input type="number" min="0.01" step="0.01" value={materiales[orden.id]?.cantidad ?? ""} onChange={(e) => cambiarMaterial(orden.id, "cantidad", e.target.value)} /></label>
                    <label>Unidad<input value={materiales[orden.id]?.unidad ?? ""} onChange={(e) => cambiarMaterial(orden.id, "unidad", e.target.value)} /></label>
                    <label>Costo unitario estimado (opcional)<input type="number" min="0" step="0.01" value={materiales[orden.id]?.costo ?? ""} onChange={(e) => cambiarMaterial(orden.id, "costo", e.target.value)} /></label>
                    <label><input type="checkbox" checked={Boolean(materiales[orden.id]?.requiereCompra)} onChange={(e) => cambiarMaterial(orden.id, "requiereCompra", e.target.checked)} /> Requiere compra</label>
                    <button type="button" disabled={ocupada === orden.id} onClick={() => registrarMaterial(orden)}>
                      {ocupada === orden.id ? "Guardando…" : "Registrar material"}
                    </button>
                  </fieldset>
                  <button type="button" disabled={ocupada === orden.id} onClick={() => registrarEvidencia(orden, "RESUELTA")}>
                    Marcar como resuelta
                  </button>
                  <fieldset>
                    <legend>Registrar bloqueo</legend>
                    <label>
                      Causal
                      <select value={bloqueos[orden.id]?.causal ?? "MATERIALES"} onChange={(e) => cambiarBloqueo(orden.id, "causal", e.target.value)}>
                        <option value="MATERIALES">Materiales</option>
                        <option value="ACCESO">Acceso</option>
                      </select>
                    </label>
                    <label>
                      Parte responsable
                      <input required value={bloqueos[orden.id]?.parteResponsable ?? ""} onChange={(e) => cambiarBloqueo(orden.id, "parteResponsable", e.target.value)} />
                    </label>
                    <label>
                      Siguiente acción
                      <input required value={bloqueos[orden.id]?.siguienteAccion ?? ""} onChange={(e) => cambiarBloqueo(orden.id, "siguienteAccion", e.target.value)} />
                    </label>
                    <label>
                      Fecha de seguimiento
                      <input type="datetime-local" required value={bloqueos[orden.id]?.seguimientoEn ?? ""} onChange={(e) => cambiarBloqueo(orden.id, "seguimientoEn", e.target.value)} />
                    </label>
                    <button type="button" disabled={ocupada === orden.id} onClick={() => registrarBloqueo(orden)}>
                      {ocupada === orden.id ? "Guardando…" : "Guardar bloqueo"}
                    </button>
                  </fieldset>
                </>
              ) : null}
              {orden.estado === "BLOQUEADA_MATERIALES" || orden.estado === "BLOQUEADA_ACCESO" ? (
                <button type="button" disabled={ocupada === orden.id} onClick={() => reanudar(orden)}>
                  Reanudar trabajo
                </button>
              ) : null}
              {["ASIGNADA", "EN_PROGRESO", "BLOQUEADA_MATERIALES", "BLOQUEADA_ACCESO"].includes(orden.estado) ? (
                <fieldset>
                  <legend>Transferir orden</legend>
                  <label>
                    Nuevo responsable
                    <select value={transferencias[orden.id]?.responsableSubject ?? ""} onChange={(e) => cambiarTransferencia(orden.id, "responsableSubject", e.target.value)}>
                      <option value="">Selecciona técnico</option>
                      {responsables.filter((r) => r.subject !== orden.responsableSubject).map((r) => (
                        <option key={r.subject} value={r.subject}>{r.nombre} · {r.unidad}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Motivo
                    <input required value={transferencias[orden.id]?.motivo ?? ""} onChange={(e) => cambiarTransferencia(orden.id, "motivo", e.target.value)} />
                  </label>
                  <button type="button" disabled={ocupada === orden.id} onClick={() => transferir(orden)}>
                    {ocupada === orden.id ? "Transfiriendo…" : "Transferir"}
                  </button>
                </fieldset>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
