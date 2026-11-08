// Persona 1 (Entrada y control): RF-01 a RF-04.
import { Router } from "express";
import { noImplementado } from "../../compartido/errores.js";
import { conTransaccion } from "../../compartido/db.js";
import { exigirRol } from "../identidad-acceso/index.js";
import { crearSolicitud, listarSolicitudes, obtenerSolicitud } from "./servicio.js";

export const router = Router();

router.post("/", exigirRol("solicitante", "coordinador"), async (req, res, next) => {
  try {
    const resultado = await conTransaccion((conn) => crearSolicitud(conn, req.body, req.usuario));
    res.status(201).json(resultado);
  } catch (err) { next(err); }
});
router.get("/", async (req, res, next) => {
  try { res.json(await listarSolicitudes(req.usuario)); } catch (err) { next(err); }
});
router.get("/:id", async (req, res, next) => {
  try { res.json(await obtenerSolicitud(req.params.id, req.usuario)); } catch (err) { next(err); }
});
router.post("/:id/validar", exigirRol("coordinador"), (_req, _res, next) => next(noImplementado("validar solicitud (RF-03)")));
router.post("/:id/rechazar", exigirRol("coordinador"), (_req, _res, next) => next(noImplementado("rechazar solicitud (RF-03)")));
router.get("/:id/duplicados-sugeridos", exigirRol("coordinador"), (_req, _res, next) => next(noImplementado("sugerir duplicados (RF-04)")));
router.post("/:id/vincular-duplicado", exigirRol("coordinador"), (_req, _res, next) => next(noImplementado("vincular duplicado (RF-04)")));
