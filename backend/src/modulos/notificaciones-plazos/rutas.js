// Persona 3 (Cierre y vigilancia): RF-02, RF-09, RF-10.
import { Router } from "express";
import { pool } from "../../compartido/db.js";

export const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const [filas] = await pool.query(
      `SELECT id, plantilla, carga, estado, intentos,
              creada_en AS creadaEn, entregada_en AS entregadaEn
         FROM entrega_notificacion
        WHERE destinatario_subject = ?
        ORDER BY creada_en DESC LIMIT 50`,
      [req.usuario.subject],
    );
    res.json(filas.map((fila) => ({
      ...fila,
      carga: typeof fila.carga === "string" ? JSON.parse(fila.carga || "{}") : (fila.carga ?? {}),
    })));
  } catch (err) { next(err); }
});
