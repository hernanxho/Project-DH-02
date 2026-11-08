// Persona 1 (Entrada y control): RF-01 a RF-04.
import { Router } from "express";
import { noImplementado } from "../../compartido/errores.js";
import { exigirRol } from "../identidad-acceso/index.js";

export const router = Router();

router.post("/", (_req, _res, next) => next(noImplementado("registrar solicitud (RF-01)")));
router.get("/", (_req, _res, next) => next(noImplementado("consultar solicitudes (RF-02)")));
router.post("/:id/validar", exigirRol("coordinador"), (_req, _res, next) => next(noImplementado("validar solicitud (RF-03)")));
router.post("/:id/rechazar", exigirRol("coordinador"), (_req, _res, next) => next(noImplementado("rechazar solicitud (RF-03)")));
router.get("/:id/duplicados-sugeridos", exigirRol("coordinador"), (_req, _res, next) => next(noImplementado("sugerir duplicados (RF-04)")));
router.post("/:id/vincular-duplicado", exigirRol("coordinador"), (_req, _res, next) => next(noImplementado("vincular duplicado (RF-04)")));
