/** Verifica que ningún módulo importe archivos internos de otro módulo (sección 5.10, QS-10).
 *  Cada módulo solo puede importarse a través de su index.js. */
module.exports = {
  forbidden: [
    {
      name: "no-importar-internos-de-otro-modulo",
      severity: "error",
      comment: "Importa el index.js del módulo, no sus archivos internos.",
      from: { path: "^src/modulos/([^/]+)/" },
      to: {
        path: "^src/modulos/([^/]+)/",
        pathNot: ["^src/modulos/$1/", "^src/modulos/[^/]+/index\\.js$"],
      },
    },
    {
      name: "dominio-no-conoce-infraestructura",
      severity: "error",
      comment: "Las reglas de dominio no dependen de la base de datos ni de adaptadores (Figura F06).",
      from: { path: "^src/modulos/[^/]+/(dominio|transiciones)" },
      to: { path: "^src/(adaptadores|compartido/db)" },
    },
  ],
  options: { doNotFollow: { path: "node_modules" } },
};
