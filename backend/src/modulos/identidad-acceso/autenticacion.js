// Autenticación SIMULADA (ASM-001): el cliente envía el encabezado `x-subject`.
// Los ROLES nunca se aceptan del navegador: se leen de la tabla asignacion_rol (5.5).
import { buscarPersona } from "../../adaptadores/identidad.js";
import { pool } from "../../compartido/db.js";
import { noAutenticado, prohibido } from "../../compartido/errores.js";

export async function autenticar(req, _res, next) {
  try {
    const persona = await buscarPersona(req.header("x-subject"));
    if (!persona) throw noAutenticado();
    const [roles] = await pool.query("SELECT rol, alcance FROM asignacion_rol WHERE subject = ?", [persona.subject]);
    req.usuario = { subject: persona.subject, nombre: persona.nombre, roles };
    next();
  } catch (err) {
    next(err);
  }
}

export const exigirRol = (...permitidos) => (req, _res, next) =>
  req.usuario?.roles.some((r) => permitidos.includes(r.rol)) ? next() : next(prohibido());
