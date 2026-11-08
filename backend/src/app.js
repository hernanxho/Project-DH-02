// Ensambla la aplicación Express. Capa de entrada: rutas → autenticación → módulos (Figura F06).
import express from "express";
import cors from "cors";
import { ErrorApp } from "./compartido/errores.js";
import { pool } from "./compartido/db.js";
import { autenticar, router as identidadRouter } from "./modulos/identidad-acceso/index.js";
import { router as solicitudesRouter } from "./modulos/solicitudes-triage/index.js";
import { router as ordenesRouter, routerCierres } from "./modulos/ordenes-trabajo/index.js";
import { router as ejecucionRouter } from "./modulos/ejecucion-evidencia/index.js";
import { router as notificacionesRouter } from "./modulos/notificaciones-plazos/index.js";
import { router as reportesRouter } from "./modulos/reportes-tablero/index.js";
import { router as adjuntosRouter } from "./modulos/archivos-adjuntos/index.js";

export function crearApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "8mb" }));

  // Pública: comprobar que el servidor y la base de datos responden
  app.get("/api/salud", async (_req, res, next) => {
    try {
      await pool.query("SELECT 1");
      res.json({ estado: "ok", baseDatos: "ok" });
    } catch (err) {
      next(err);
    }
  });

  // Todo lo demás exige identidad
  app.use("/api", autenticar);
  app.use("/api/identidad", identidadRouter);
  app.use("/api/solicitudes", solicitudesRouter);
  app.use("/api/adjuntos", adjuntosRouter);
  app.use("/api/ordenes", ordenesRouter);
  app.use("/api/ejecucion", ejecucionRouter);
  app.use("/api/notificaciones", routerCierres);
  app.use("/api/notificaciones", notificacionesRouter);
  app.use("/api/reportes", reportesRouter);

  // Manejador global de errores
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof ErrorApp) return res.status(err.estado).json({ codigo: err.codigo, mensaje: err.message });
    if (err?.type === "entity.too.large") return res.status(413).json({ codigo: "ARCHIVO_DEMASIADO_GRANDE", mensaje: "El contenido enviado supera el límite permitido" });
    if (err instanceof SyntaxError && err.status === 400 && "body" in err) return res.status(400).json({ codigo: "JSON_INVALIDO", mensaje: "El cuerpo de la solicitud no contiene JSON válido" });
    console.error(err);
    res.status(500).json({ codigo: "ERROR_INTERNO", mensaje: "Error interno" });
  });

  return app;
}
