import { createHash } from "node:crypto";
import { ErrorApp } from "./errores.js";
import { conTransaccion } from "./db.js";

export function conComando(req, ejecutar) {
  return conTransaccion((conn) => conIdempotencia(conn, {
    clave: req.get("Idempotency-Key"),
    actor: req.usuario.subject,
    huella: createHash("sha256").update(`${req.method}:${req.originalUrl}:${JSON.stringify(req.body ?? null)}`).digest("hex"),
  }, () => ejecutar(conn)));
}

export async function conIdempotencia(conn, { clave, actor, huella }, ejecutar) {
  if (typeof clave !== "string" || !clave.trim() || clave.length > 64) {
    throw new ErrorApp(400, "CLAVE_IDEMPOTENCIA_REQUERIDA", "Cada comando debe incluir un encabezado Idempotency-Key válido");
  }
  const [insercion] = await conn.query(
    `INSERT IGNORE INTO comando_procesado (clave_idempotencia, actor_subject, huella, resultado)
     VALUES (?, ?, ?, NULL)`,
    [clave, actor, huella],
  );
  if (insercion.affectedRows === 0) {
    const [filas] = await conn.query(
      "SELECT actor_subject, huella, resultado FROM comando_procesado WHERE clave_idempotencia = ? FOR UPDATE",
      [clave],
    );
    const recibo = filas[0];
    if (!recibo || recibo.actor_subject !== actor) {
      throw new ErrorApp(409, "CLAVE_IDEMPOTENCIA_EN_USO", "Esta clave ya se usó para otro comando");
    }
    if (recibo.huella !== huella) {
      throw new ErrorApp(409, "CLAVE_IDEMPOTENCIA_REUTILIZADA", "La clave de idempotencia ya corresponde a un comando diferente");
    }
    if (recibo.resultado === null) {
      throw new ErrorApp(409, "COMANDO_SIN_RESULTADO", "El comando anterior no tiene un resultado confirmado");
    }
    return typeof recibo.resultado === "string" ? JSON.parse(recibo.resultado) : recibo.resultado;
  }

  const resultado = await ejecutar();
  await conn.query(
    "UPDATE comando_procesado SET resultado = ? WHERE clave_idempotencia = ? AND actor_subject = ?",
    [JSON.stringify(resultado), clave, actor],
  );
  return resultado;
}
