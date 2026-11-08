// Servicio de identidad SIMULADO (ASM-001). Imita el contrato de un servicio externo.
// Solo reconoce 'subject'; los roles viven en identidad-acceso (tabla asignacion_rol).
const personas = [
  { subject: "u-solicitante-1",   nombre: "Ana Solicitante",   correo: "ana@horizon.test" },
  { subject: "u-coordinador-1",   nombre: "Carlos Coordinador", correo: "carlos@horizon.test" },
  { subject: "u-supervisor-1",    nombre: "Sofía Supervisora",  correo: "sofia@horizon.test" },
  { subject: "u-tecnico-1",       nombre: "Tomás Técnico",      correo: "tomas@horizon.test" },
  { subject: "u-tecnico-2",       nombre: "Teresa Técnica",     correo: "teresa@horizon.test" },
  { subject: "u-representante-1", nombre: "Rosa Representante", correo: "rosa@horizon.test" },
];

export async function buscarPersona(subject) {
  return personas.find((p) => p.subject === subject) ?? null;
}
