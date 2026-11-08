import { crearApp } from "./app.js";
import { config } from "./compartido/config.js";
import { iniciarPlanificador } from "./planificador/index.js";

crearApp().listen(config.puerto, () => {
  console.log(`API escuchando en http://localhost:${config.puerto}`);
  iniciarPlanificador();
});
