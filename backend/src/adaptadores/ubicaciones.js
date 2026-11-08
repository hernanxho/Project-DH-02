// Directorio de ubicaciones SIMULADO (ASM-017, ASM-021).
// TODO: cargar las ubicaciones reales desde el pack del profesor.
const ubicaciones = [
  { codigo: "A-101", nombre: "Edificio A, aula 101", activa: true },
  { codigo: "A-102", nombre: "Edificio A, aula 102", activa: true },
  { codigo: "B-LAB1", nombre: "Edificio B, laboratorio 1", activa: true },
];

export async function buscarUbicacion(codigo) {
  return ubicaciones.find((u) => u.codigo === codigo) ?? null;
}
