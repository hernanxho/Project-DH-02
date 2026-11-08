// Reglas y Políticas versionadas (5.5). Cada evaluación debe registrar la versión de la regla usada.
import { pool } from "../../compartido/db.js";

export async function obtenerRegla(clave) {
  const [filas] = await pool.query(
    "SELECT version, valor FROM regla_politica WHERE clave = ? AND vigente = TRUE ORDER BY version DESC LIMIT 1",
    [clave],
  );
  return filas[0] ?? null;
}

// Variante para leer una regla dentro de la misma transacción que evalúa el comando.
export async function obtenerReglaConConexion(conn, clave) {
  const [filas] = await conn.query(
    "SELECT version, valor FROM regla_politica WHERE clave = ? AND vigente = TRUE ORDER BY version DESC LIMIT 1",
    [clave],
  );
  return filas[0] ?? null;
}
// TODO (persona 3): matriz de evidencia por transición configurable (ASM-010).
