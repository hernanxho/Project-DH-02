// Persona 1 (Entrada y control): RF-01 a RF-04.
import { Router } from "express";
import { conComando } from "../../compartido/idempotencia.js";
import { exigirRol } from "../identidad-acceso/index.js";
import { consultarAuditoria } from "../auditoria/index.js";
import { buscarDuplicados, crearSolicitud, listarSolicitudes, obtenerCatalogosSolicitud, obtenerSolicitud, rechazarSolicitud, validarSolicitud, verificarUbicacionSolicitud, vincularDuplicado } from "./servicio.js";

export const router = Router();

router.post("/", exigirRol("solicitante", "coordinador"), async (req, res, next) => {
  try {
    const resultado = await conComando(req, (conn) => crearSolicitud(conn, req.body, req.usuario));
    res.status(201).json(resultado);
  } catch (err) { next(err); }
});
router.get("/catalogos", async (_req, res, next) => {
  try { res.json(await obtenerCatalogosSolicitud()); } catch (err) { next(err); }
});
router.get("/", async (req, res, next) => {
  try { res.json(await listarSolicitudes(req.usuario)); } catch (err) { next(err); }
});
router.get("/:id", async (req, res, next) => {
  try { res.json(await obtenerSolicitud(req.params.id, req.usuario)); } catch (err) { next(err); }
});
router.get("/:id/historial", async (req, res, next) => {
  try { res.json(await consultarAuditoria("solicitud", req.params.id, req.usuario)); } catch (err) { next(err); }
});
router.post("/:id/validar", exigirRol("coordinador"), async (req, res, next) => {
  try {
    const resultado = await conComando(req, (conn) => validarSolicitud(conn, req.params.id, req.body, req.usuario));
    res.json(resultado);
  } catch (err) { next(err); }
});
router.post("/:id/verificar-ubicacion", exigirRol("coordinador"), async (req, res, next) => {
  try {
    const resultado = await conComando(req, (conn) => verificarUbicacionSolicitud(conn, req.params.id, req.body, req.usuario));
    res.json(resultado);
  } catch (err) { next(err); }
});
router.post("/:id/rechazar", exigirRol("coordinador"), async (req, res, next) => {
  try {
    const resultado = await conComando(req, (conn) => rechazarSolicitud(conn, req.params.id, req.body, req.usuario));
    res.json(resultado);
  } catch (err) { next(err); }
});
router.get("/:id/duplicados-sugeridos", exigirRol("coordinador"), async (req, res, next) => {
  try { res.json(await buscarDuplicados(req.params.id, req.usuario)); } catch (err) { next(err); }
});
router.post("/:id/vincular-duplicado", exigirRol("coordinador"), async (req, res, next) => {
  try {
    const resultado = await conComando(req, (conn) => vincularDuplicado(conn, req.params.id, req.body, req.usuario));
    res.json(resultado);
  } catch (err) { next(err); }
});
