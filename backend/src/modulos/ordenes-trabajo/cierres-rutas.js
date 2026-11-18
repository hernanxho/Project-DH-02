import { Router } from "express";
import { conComando } from "../../compartido/idempotencia.js";
import { confirmarCierre, listarPendientesCierre, rechazarCierre, reabrirOrden } from "./servicio.js";

export const routerCierres = Router();

routerCierres.get("/pendientes", async (req, res, next) => {
  try { res.json(await listarPendientesCierre(req.usuario)); } catch (err) { next(err); }
});

routerCierres.post("/ordenes/:id/confirmar-cierre", async (req, res, next) => {
  try {
    const resultado = await conComando(req, (conn) => confirmarCierre(conn, req.params.id, req.body, req.usuario));
    res.json(resultado);
  } catch (err) { next(err); }
});

routerCierres.post("/ordenes/:id/rechazar-cierre", async (req, res, next) => {
  try {
    const resultado = await conComando(req, (conn) => rechazarCierre(conn, req.params.id, req.body, req.usuario));
    res.json(resultado);
  } catch (err) { next(err); }
});

routerCierres.post("/ordenes/:id/reabrir", async (req, res, next) => {
  try {
    const resultado = await conComando(req, (conn) => reabrirOrden(conn, req.params.id, req.body, req.usuario));
    res.status(201).json(resultado);
  } catch (err) { next(err); }
});
