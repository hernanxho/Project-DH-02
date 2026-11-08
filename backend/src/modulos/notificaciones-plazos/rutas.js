// Persona 3 (Cierre y vigilancia): RF-02, RF-09, RF-10.
import { Router } from "express";
import { noImplementado } from "../../compartido/errores.js";

export const router = Router();

router.get("/pendientes", (_req, _res, next) => next(noImplementado("apartado de pendientes del afectado (RF-09)")));
router.post("/ordenes/:id/confirmar-cierre", (_req, _res, next) => next(noImplementado("confirmar cierre (RF-09)")));
router.post("/ordenes/:id/rechazar-cierre", (_req, _res, next) => next(noImplementado("rechazar cierre (RF-09)")));
router.post("/ordenes/:id/reabrir", (_req, _res, next) => next(noImplementado("reabrir caso (RF-10)")));
