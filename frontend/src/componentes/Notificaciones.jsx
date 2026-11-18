import { useCallback, useEffect, useState } from "react";
import { api } from "../api/cliente.js";

export default function Notificaciones() {
  const [notificaciones, setNotificaciones] = useState([]);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    try {
      setNotificaciones(await api("/notificaciones"));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    void cargar();
    const intervalo = setInterval(() => { void cargar(); }, 60_000);
    return () => clearInterval(intervalo);
  }, [cargar]);

  return (
    <details>
      <summary>Notificaciones ({notificaciones.filter((n) => n.estado === "PENDIENTE" || n.estado === "FALLIDA").length} por entregar)</summary>
      {error ? <p role="alert">{error}</p> : null}
      {notificaciones.length === 0 ? <p>No tienes notificaciones.</p> : (
        <ul>
          {notificaciones.map((n) => (
            <li key={n.id}>
              <strong>{n.plantilla}</strong> · {n.estado} · {new Date(n.creadaEn).toLocaleString()}
              {n.carga?.ordenId ? ` · Orden ${n.carga.ordenId}` : ""}
              {n.carga?.solicitudId ? ` · Solicitud ${n.carga.solicitudId}` : ""}
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={cargar}>Actualizar notificaciones</button>
    </details>
  );
}
