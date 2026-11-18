// Configuración centralizada. Los valores vienen de variables de entorno (.env).
export const config = {
  puerto: Number(process.env.PORT ?? 3000),
  db: {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "dh02",
    password: process.env.DB_PASSWORD ?? "dh02",
    database: process.env.DB_NAME ?? "dh02",
  },
  almacenAdjuntos: process.env.ALMACEN_ADJUNTOS ?? "./almacen",
};
