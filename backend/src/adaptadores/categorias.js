// Catálogo de categorías de mantenimiento publicado en el pack DH-02.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { leerCsv } from "./csv.js";

const ruta = new URL("../../../data/dh02-release1/data/reference/maintenance_categories.csv", import.meta.url);
const categorias = leerCsv(readFileSync(fileURLToPath(ruta), "utf8"))
  .filter((fila) => fila.active === "true")
  .map((fila) => ({ codigo: fila.category_code, nombre: fila.display_name }));

export async function buscarCategoria(codigo) {
  return categorias.find((categoria) => categoria.codigo === codigo) ?? null;
}

export async function listarCategorias() {
  return categorias;
}
