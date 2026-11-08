// Persona 1 (Entrada y control): RF-13.
import { Router } from "express";

export const router = Router();

// Devuelve quién es el usuario autenticado y sus roles (útil para el frontend).
router.get("/yo", (req, res) => res.json(req.usuario));
