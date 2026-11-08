// Persona 2 (Núcleo de órdenes): evidencia, materiales y bloqueos de la ejecución (RF-07).
// Importante: este módulo NO cambia el estado de la orden; solicita la transición a ordenes-trabajo.
import { Router } from "express";
import { conComando } from "../../compartido/idempotencia.js";
import { registrarBloqueo, registrarDesbloqueoAcceso, registrarEvidencia, registrarMaterial } from "./servicio.js";

export const router = Router();

router.post("/:ordenId/evidencias", async (req, res, next) => {
  try {
    const resultado = await conComando(req, (conn) => registrarEvidencia(conn, req.params.ordenId, req.body, req.usuario));
    res.status(201).json(resultado);
  } catch (err) { next(err); }
});
router.post("/:ordenId/materiales", async (req, res, next) => {
  try {
    const resultado = await conComando(req, (conn) => registrarMaterial(conn, req.params.ordenId, req.body, req.usuario));
    res.status(201).json(resultado);
  } catch (err) { next(err); }
});
router.post("/:ordenId/bloqueos", async (req, res, next) => {
  try {
    const resultado = await conComando(req, (conn) => registrarBloqueo(conn, req.params.ordenId, req.body, req.usuario));
    res.status(201).json(resultado);
  } catch (err) { next(err); }
});
router.post("/:ordenId/desbloqueos", async (req, res, next) => {
  try {
    const resultado = await conComando(req, (conn) => registrarDesbloqueoAcceso(conn, req.params.ordenId, req.body, req.usuario));
    res.json(resultado);
  } catch (err) { next(err); }
});
