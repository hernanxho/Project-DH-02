// Persona 3 (Cierre y vigilancia): RF-12. Consultas de solo lectura con definiciones de negocio únicas.
import { Router } from "express";
import { noImplementado } from "../../compartido/errores.js";
import { exigirRol } from "../identidad-acceso/index.js";

export const router = Router();

router.get("/tablero", exigirRol("supervisor", "coordinador"), (_req, _res, next) => next(noImplementado("tablero operativo (RF-12)")));
