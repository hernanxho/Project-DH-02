// Directorio de ubicaciones SIMULADO (ASM-017, ASM-021).
// TODO: cargar las ubicaciones reales desde el pack del profesor.
const ubicaciones = [
  { codigo: "A-101", edificioCodigo: "edificio-A", nombre: "Edificio A, aula 101", activa: true, restringida: false },
  { codigo: "A-102", edificioCodigo: "edificio-A", nombre: "Edificio A, aula 102", activa: true, restringida: false },
  { codigo: "B-LAB1", edificioCodigo: "edificio-B", nombre: "Edificio B, laboratorio 1", activa: true, restringida: false },
];

export async function buscarUbicacion(codigo) {
  return ubicaciones.find((u) => u.codigo === codigo) ?? null;
}
