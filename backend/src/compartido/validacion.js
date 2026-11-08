// Validación de esquemas de entrada con zod. Úsalo en cada controlador.
import { ErrorApp } from "./errores.js";

export function validar(esquema, datos) {
  const r = esquema.safeParse(datos);
  if (!r.success) {
    throw new ErrorApp(400, "VALIDACION", r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
  return r.data;
}
