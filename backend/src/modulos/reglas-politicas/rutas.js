import { Router } from "express";
import { conComando } from "../../compartido/idempotencia.js";
import { exigirRol } from "../identidad-acceso/index.js";
import { actualizarRegla, listarReglas } from "./servicio.js";

export const router = Router();

router.get("/", exigirRol("coordinador", "supervisor"), async (_req, res, next) => {
  try { res.json(await listarReglas()); } catch (err) { next(err); }
});

router.put("/:clave", exigirRol("supervisor"), async (req, res, next) => {
  try {
    const resultado = await conComando(req, (conn) => actualizarRegla(conn, {
      clave: req.params.clave,
      valor: req.body?.valor,
      versionVista: req.body?.versionVista,
      actor: req.usuario.subject,
    }));
    res.json(resultado);
  } catch (err) { next(err); }
});
