// Proyección de solo lectura del Campus Location Directory simulado del pack.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { leerCsv } from "./csv.js";

const base = "../../../data/dh02-release1/";
const directorio = JSON.parse(readFileSync(fileURLToPath(new URL(`${base}mocks/campus_location_directory/locations.json`, import.meta.url)), "utf8"));
const edificios = leerCsv(readFileSync(fileURLToPath(new URL(`${base}data/reference/buildings.csv`, import.meta.url)), "utf8"));
const campus = leerCsv(readFileSync(fileURLToPath(new URL(`${base}data/reference/campuses.csv`, import.meta.url)), "utf8"));
const edificioPorCodigo = new Map(edificios.map((fila) => [fila.building_code, fila]));
const campusPorCodigo = new Map(campus.map((fila) => [fila.campus_code, fila]));

const ubicaciones = directorio.records.map((fila) => {
  const edificio = edificioPorCodigo.get(fila.building_code);
  const nombreEdificio = edificio?.building_name ?? fila.building_code;
  const nombreCampus = campusPorCodigo.get(fila.campus_code)?.campus_name ?? fila.campus_code;
  return {
    codigo: fila.location_code,
    campusCodigo: fila.campus_code,
    campusNombre: nombreCampus,
    edificioCodigo: fila.building_code,
    edificioNombre: nombreEdificio,
    piso: fila.floor,
    espacio: fila.room_or_area,
    tipo: fila.location_type,
    nombre: `${nombreEdificio} · ${fila.room_or_area}`,
    restringida: fila.restricted_access,
    activa: fila.active,
  };
});

export async function buscarUbicacion(codigo) {
  return ubicaciones.find((ubicacion) => ubicacion.codigo === codigo) ?? null;
}

export async function listarUbicaciones({ incluirInactivas = false } = {}) {
  return ubicaciones.filter((ubicacion) => incluirInactivas || ubicacion.activa);
}
