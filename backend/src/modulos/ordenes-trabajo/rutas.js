// Persona 2 (Núcleo de órdenes): RF-05 a RF-08.
import { Router } from "express";
import { noImplementado } from "../../compartido/errores.js";
import { exigirRol } from "../identidad-acceso/index.js";

export const router = Router();

// RF-05: crear orden desde una solicitud validada y asignar responsable explícito
router.post("/", exigirRol("coordinador", "supervisor"), (_req, _res, next) => next(noImplementado("crear orden (RF-05)")));
// RF-06: el técnico ve sus órdenes asignadas
router.get("/", (_req, _res, next) => next(noImplementado("listar órdenes (RF-06)")));
// RF-07: cambiar estado (transición con evidencia y versión vista)
router.post("/:id/transiciones", (_req, _res, next) => next(noImplementado("transición de estado (RF-07)")));
// RF-08: transferir / reasignar
router.post("/:id/transferencias", (_req, _res, next) => next(noImplementado("transferir orden (RF-08)")));
router.post("/:id/reasignaciones", exigirRol("supervisor"), (_req, _res, next) => next(noImplementado("reasignar orden (RF-08)")));
