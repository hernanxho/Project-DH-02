import { useCallback, useEffect, useState } from "react";
import { api } from "../api/cliente.js";
import Solicitante from "./Solicitante.jsx";

export default function Representante() {
  const [ordenes, setOrdenes] = useState([]);
  const [resumenes, setResumenes] = useState({});
  const [error, setError] = useState("");
  const [ocupada, setOcupada] = useState("");

  const cargar = useCallback(async () => {
    try {
      setOrdenes(await api("/ordenes/bloqueos-acceso"));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function habilitarAcceso(orden) {
    setOcupada(orden.ordenId);
    setError("");
    try {
      await api(`/ejecucion/${encodeURIComponent(orden.ordenId)}/desbloqueos`, {
        metodo: "POST",
        cuerpo: {
          versionVista: orden.version,
          resumen: resumenes[orden.ordenId]?.trim() || "Acceso confirmado por representante del edificio.",
        },
      });
      await cargar();
    } catch (e) {
      setError(e.message);
      await cargar();
    } finally {
      setOcupada("");
    }
  }

  return (
    <>
      <Solicitante />
      <section>
        <h2>Órdenes a la espera de acceso en mi edificio</h2>
        <button type="button" onClick={cargar}>Actualizar</button>
        {error ? <p role="alert" style={{ color: "crimson" }}>{error}</p> : null}
        {ordenes.length === 0 ? <p>No hay órdenes bloqueadas por acceso en tu alcance.</p> : (
          <ul>
            {ordenes.map((orden) => (
              <li key={orden.ordenId}>
                <strong>{orden.ordenId}</strong> · {orden.ubicacionCodigo} · {orden.categoria}
                <p>{orden.descripcion}</p>
                <p>Solicitado: {orden.siguienteAccion}</p>
                <label>
                  Nota de acceso
                  <input
                    maxLength={2000}
                    value={resumenes[orden.ordenId] ?? ""}
                    onChange={(e) => setResumenes((previo) => ({ ...previo, [orden.ordenId]: e.target.value }))}
                  />
                </label>{" "}
                <button type="button" disabled={ocupada === orden.ordenId} onClick={() => habilitarAcceso(orden)}>
                  {ocupada === orden.ordenId ? "Guardando…" : "Confirmar acceso y reanudar"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
