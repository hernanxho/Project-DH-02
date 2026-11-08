// Identidad simulada basada en el directorio del pack DH-02.
// TECH-004 a TECH-007 no aparecen en mock_identities.json; su identidad básica
// se proyecta desde technicians.csv, como requiere el modelo de la Evaluación 2.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { leerCsv } from "./csv.js";

const rutaIdentidades = new URL("../../../data/dh02-release1/data/reference/mock_identities.json", import.meta.url);
const rutaTecnicos = new URL("../../../data/dh02-release1/data/reference/technicians.csv", import.meta.url);
const directorio = JSON.parse(readFileSync(fileURLToPath(rutaIdentidades), "utf8"));
const tecnicos = leerCsv(readFileSync(fileURLToPath(rutaTecnicos), "utf8"));

const personas = new Map(directorio.map((persona) => [persona.user_id, {
  subject: persona.user_id,
  nombre: persona.display_name,
  correo: persona.email,
  rolInstitucional: persona.institutional_role,
  activa: persona.active,
}]));

for (const tecnico of tecnicos) {
  if (!personas.has(tecnico.technician_id)) {
    personas.set(tecnico.technician_id, {
      subject: tecnico.technician_id,
      nombre: tecnico.display_name,
      correo: tecnico.institutional_email,
      rolInstitucional: "EMPLOYEE",
      activa: tecnico.active === "true",
    });
  }
}

export async function buscarPersona(subject) {
  const persona = personas.get(subject);
  return persona?.activa ? persona : null;
}
