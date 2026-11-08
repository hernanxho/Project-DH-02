import test from "node:test";
import assert from "node:assert/strict";
import { crearHuellaComando } from "../src/compartido/idempotencia.js";

test("la huella no depende del orden de las propiedades JSON", () => {
  const primera = { solicitudId: "MR-1", responsable: { subject: "TECH-1", prioridad: "Alta" } };
  const reordenada = { responsable: { prioridad: "Alta", subject: "TECH-1" }, solicitudId: "MR-1" };
  assert.equal(crearHuellaComando("POST", "/api/ordenes", primera), crearHuellaComando("POST", "/api/ordenes", reordenada));
});

test("la huella distingue cambios de contenido y conserva el orden de las listas", () => {
  const base = { ids: ["A", "B"], valor: 1 };
  assert.notEqual(crearHuellaComando("POST", "/api/x", base), crearHuellaComando("POST", "/api/x", { ...base, valor: 2 }));
  assert.notEqual(crearHuellaComando("POST", "/api/x", base), crearHuellaComando("POST", "/api/x", { ids: ["B", "A"], valor: 1 }));
});
