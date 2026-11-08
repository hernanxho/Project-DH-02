import { useCallback, useEffect, useState } from "react";
import { api } from "../api/cliente.js";

const inicial = { ubicacionCodigo: "", categoria: "", descripcion: "", urgenciaSugerida: "Normal" };

export default function Solicitante() {
  const [formulario, setFormulario] = useState(inicial);
  const [foto, setFoto] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [motivosCierre, setMotivosCierre] = useState({});
  const [descripcionesReapertura, setDescripcionesReapertura] = useState({});
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [listaSolicitudes, listaPendientes] = await Promise.all([
        api("/solicitudes"),
        api("/notificaciones/pendientes"),
      ]);
      setSolicitudes(listaSolicitudes);
      setPendientes(listaPendientes);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  function cambiar(campo, valor) {
    setFormulario((anterior) => ({ ...anterior, [campo]: valor }));
  }

  function leerBase64(archivo) {
    return new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(String(lector.result).split(",")[1] ?? "");
      lector.onerror = () => reject(new Error("No se pudo leer la imagen"));
      lector.readAsDataURL(archivo);
    });
  }

  async function enviar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      let adjuntoIds = [];
      if (foto) {
        const contenidoBase64 = await leerBase64(foto);
        const archivoSubido = await api("/adjuntos", {
          metodo: "POST",
          cuerpo: { nombreArchivo: foto.name, mimeType: foto.type, contenidoBase64 },
        });
        adjuntoIds = [archivoSubido.id];
      }
      const creada = await api("/solicitudes", { metodo: "POST", cuerpo: { ...formulario, adjuntoIds } });
      setMensaje(`Solicitud ${creada.id} registrada para revisión.`);
      setFormulario(inicial);
      setFoto(null);
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function responderCierre(pendiente, accion) {
    const motivo = motivosCierre[pendiente.ordenId]?.trim();
    if (accion === "rechazar-cierre" && !motivo) {
      setError("Escribe el motivo para rechazar el cierre.");
      return;
    }
    setError("");
    setMensaje("");
    try {
      await api(`/notificaciones/ordenes/${encodeURIComponent(pendiente.ordenId)}/${accion}`, {
        metodo: "POST",
        cuerpo: { versionVista: pendiente.version, ...(motivo ? { motivo } : {}) },
      });
      setMensaje(accion === "confirmar-cierre" ? `Cerraste la orden ${pendiente.ordenId}.` : `La orden ${pendiente.ordenId} vuelve a trabajo.`);
      await cargar();
    } catch (e) {
      setError(e.message);
      await cargar();
    }
  }

  async function reabrir(solicitud) {
    const descripcion = descripcionesReapertura[solicitud.ordenId]?.trim();
    if (!descripcion) {
      setError("Describe brevemente por qué el problema continúa.");
      return;
    }
    setError("");
    setMensaje("");
    try {
      const resultado = await api(`/notificaciones/ordenes/${encodeURIComponent(solicitud.ordenId)}/reabrir`, {
        metodo: "POST",
        cuerpo: { versionVista: solicitud.versionOrden, descripcion },
      });
      setMensaje(`Nueva solicitud ${resultado.solicitudId} enviada a revisión.`);
      await cargar();
    } catch (e) {
      setError(e.message);
      await cargar();
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
          Foto del problema (JPEG, PNG o WebP; hasta 5 MB)
          <input key={foto?.name ?? "sin-foto"} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
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
              {solicitud.estadoOrden === "CERRADA" ? (
                <>
                  <label>
                    Si el problema continúa, descríbelo para reabrirlo
                    <input
                      maxLength={4000}
                      value={descripcionesReapertura[solicitud.ordenId] ?? ""}
                      onChange={(e) => setDescripcionesReapertura((anterior) => ({ ...anterior, [solicitud.ordenId]: e.target.value }))}
                    />
                  </label>{" "}
                  <button type="button" onClick={() => reabrir(solicitud)}>Crear solicitud de reapertura</button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <h2>Pendientes de confirmar</h2>
      {pendientes.length === 0 ? <p>No tienes cierres pendientes.</p> : (
        <ul>
          {pendientes.map((pendiente) => (
            <li key={pendiente.ordenId} style={{ margin: "1rem 0" }}>
              <strong>{pendiente.ordenId}</strong> · {pendiente.estado} · {pendiente.ubicacionCodigo} · {pendiente.categoria}
              <p>{pendiente.descripcion}</p>
              <p>Plazo hasta: {new Date(pendiente.venceEn).toLocaleString()}</p>
              <button type="button" onClick={() => responderCierre(pendiente, "confirmar-cierre")}>Confirmar cierre</button>{" "}
              <label>
                Motivo para rechazar
                <input
                  required
                  value={motivosCierre[pendiente.ordenId] ?? ""}
                  onChange={(e) => setMotivosCierre((anterior) => ({ ...anterior, [pendiente.ordenId]: e.target.value }))}
                />
              </label>{" "}
              <button type="button" onClick={() => responderCierre(pendiente, "rechazar-cierre")}>Rechazar cierre</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
