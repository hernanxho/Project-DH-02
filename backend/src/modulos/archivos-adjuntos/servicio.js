import { ErrorApp } from "../../compartido/errores.js";

export async function vincularAdjuntos(conn, ids, { entidad, entidadId }, actor) {
  if (!ids?.length) return;
  if (!new Set(["solicitud", "evidencia"]).has(entidad)) {
    throw new ErrorApp(500, "VINCULO_ADJUNTO_INVALIDO", "El tipo de vínculo del archivo no es válido");
  }
  const columna = entidad === "solicitud" ? "solicitud_id" : "evidencia_id";
  const placeholders = ids.map(() => "?").join(", ");
  const [resultado] = await conn.query(
    `UPDATE adjunto SET ${columna} = ?
      WHERE id IN (${placeholders}) AND subido_por = ?
        AND solicitud_id IS NULL AND evidencia_id IS NULL`,
    [entidadId, ...ids, actor.subject],
  );
  if (resultado.affectedRows !== new Set(ids).size) {
    throw new ErrorApp(403, "ADJUNTO_NO_DISPONIBLE", "Uno o más archivos no existen o ya fueron vinculados");
  }
}
