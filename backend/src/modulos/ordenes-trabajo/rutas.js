// Persona 2 (Núcleo de órdenes): RF-05 a RF-08.
import { Router } from "express";
import { conComando } from "../../compartido/idempotencia.js";
import { exigirRol } from "../identidad-acceso/index.js";
import { consultarAuditoria } from "../auditoria/index.js";
import { corregirCategoriaOrden, crearOrden, listarBloqueosAcceso, listarOrdenesTecnico, listarResponsables, solicitarTransicion, transferirOrden } from "./servicio.js";

export const router = Router();

// Responsables para el selector de asignación de coordinación/supervisión.
router.get("/responsables", exigirRol("tecnico", "coordinador", "supervisor"), async (_req, res, next) => {
  try { res.json(await listarResponsables()); } catch (err) { next(err); }
});
// RF-05: crear orden desde una solicitud validada y asignar responsable explícito.
router.post("/", exigirRol("coordinador", "supervisor"), async (req, res, next) => {
  try {
    const resultado = await conComando(req, (conn) => crearOrden(conn, req.body, req.usuario));
    res.status(201).json(resultado);
  } catch (err) { next(err); }
});
// RF-06: la consulta siempre limita el resultado al subject autenticado.
router.get("/", exigirRol("tecnico", "contratista"), async (req, res, next) => {
  try { res.json(await listarOrdenesTecnico(req.usuario, req.query)); } catch (err) { next(err); }
});
router.get("/bloqueos-acceso", exigirRol("representante"), async (req, res, next) => {
  try { res.json(await listarBloqueosAcceso(req.usuario)); } catch (err) { next(err); }
});
router.get("/:id/historial", async (req, res, next) => {
  try { res.json(await consultarAuditoria("orden", req.params.id, req.usuario)); } catch (err) { next(err); }
});
router.put("/:id/categoria", async (req, res, next) => {
  try {
    const resultado = await conComando(req, (conn) => corregirCategoriaOrden(conn, req.params.id, req.body, req.usuario));
    res.json(resultado);
  } catch (err) { next(err); }
});
// RF-07: cambiar estado (transición con evidencia y versión vista)
router.post("/:id/transiciones", async (req, res, next) => {
  try {
    const resultado = await conComando(req, (conn) => solicitarTransicion(conn, { ...req.body, ordenId: req.params.id }, req.usuario));
    res.json(resultado);
  } catch (err) { next(err); }
});
// RF-08: transferir / reasignar con el historial de asignaciones en la misma transacción.
router.post("/:id/transferencias", async (req, res, next) => {
  try {
    const resultado = await conComando(req, (conn) => transferirOrden(conn, req.params.id, req.body, req.usuario, "TRANSFERENCIA"));
    res.json(resultado);
  } catch (err) { next(err); }
});
router.post("/:id/reasignaciones", exigirRol("supervisor"), async (req, res, next) => {
  try {
    const resultado = await conComando(req, (conn) => transferirOrden(conn, req.params.id, req.body, req.usuario, "REASIGNACION"));
    res.json(resultado);
  } catch (err) { next(err); }
});
