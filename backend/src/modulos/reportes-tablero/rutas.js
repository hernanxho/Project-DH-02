// Persona 3 (Cierre y vigilancia): RF-12. Consultas de solo lectura con definiciones de negocio únicas.
import { Router } from "express";
import { exigirRol } from "../identidad-acceso/index.js";
import { obtenerTablero } from "./servicio.js";

export const router = Router();

router.get("/tablero", exigirRol("supervisor", "coordinador"), async (req, res, next) => {
  try { res.json(await obtenerTablero(req.usuario)); } catch (err) { next(err); }
});
