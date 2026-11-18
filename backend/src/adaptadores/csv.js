export function leerCsv(texto) {
  const filas = [];
  let fila = [];
  let campo = "";
  let entreComillas = false;
  const entrada = texto.replace(/^\uFEFF/, "");

  for (let i = 0; i <= entrada.length; i += 1) {
    const caracter = entrada[i];
    if (entreComillas) {
      if (caracter === '"' && entrada[i + 1] === '"') {
        campo += '"';
        i += 1;
      } else if (caracter === '"') {
        entreComillas = false;
      } else if (caracter !== undefined) {
        campo += caracter;
      }
    } else if (caracter === '"') {
      entreComillas = true;
    } else if (caracter === ",") {
      fila.push(campo);
      campo = "";
    } else if (caracter === "\n" || caracter === undefined) {
      fila.push(campo.replace(/\r$/, ""));
      if (fila.some((valor) => valor !== "")) filas.push(fila);
      fila = [];
      campo = "";
    } else {
      campo += caracter;
    }
  }

  const [encabezados, ...registros] = filas;
  if (!encabezados) return [];
  return registros.map((valores) => Object.fromEntries(
    encabezados.map((nombre, indice) => [nombre, valores[indice] ?? ""]),
  ));
}
