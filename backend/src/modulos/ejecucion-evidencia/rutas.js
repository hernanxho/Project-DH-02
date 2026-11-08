// Persona 2 (Núcleo de órdenes): evidencia, materiales y bloqueos de la ejecución (RF-07).
// Importante: este módulo NO cambia el estado de la orden; solicita la transición a ordenes-trabajo.
import { Router } from "express";
import { noImplementado } from "../../compartido/errores.js";

export const router = Router();

router.post("/:ordenId/evidencias", (_req, _res, next) => next(noImplementado("registrar evidencia (RF-07)")));
router.post("/:ordenId/materiales", (_req, _res, next) => next(noImplementado("registrar materiales (RF-07)")));
router.post("/:ordenId/bloqueos", (_req, _res, next) => next(noImplementado("registrar bloqueo (RF-07)")));
