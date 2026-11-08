// Pruebas de la tabla de transiciones (6.9): válidas y prohibidas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { transicionPermitida, buscarTransicion, TRANSICIONES } from "../src/modulos/ordenes-trabajo/transiciones.js";

test("flujo feliz: cada transición de la tabla es permitida para su actor", () => {
  for (const t of TRANSICIONES) {
    for (const actor of t.actores) {
      assert.ok(transicionPermitida(t.desde, t.hasta, actor, t.tipoCierre), `${t.desde} → ${t.hasta} (${actor})`);
    }
  }
});

test("transiciones prohibidas", () => {
  assert.equal(transicionPermitida("ASIGNADA", "RESUELTA", "responsable"), false);
  assert.equal(transicionPermitida("CERRADA", "EN_PROGRESO", "afectado"), false);
  assert.equal(transicionPermitida("CERRADA", "ASIGNADA", "supervisor"), false);
});

test("un técnico no puede cerrar una orden resuelta", () => {
  assert.equal(transicionPermitida("RESUELTA", "CERRADA", "responsable", "CONFIRMADO"), false);
});

test("el cierre automático solo lo hace el sistema", () => {
  assert.equal(transicionPermitida("RESUELTA", "CERRADA", "sistema", "AUTOMATICO"), true);
  assert.equal(transicionPermitida("RESUELTA", "CERRADA", "afectado", "AUTOMATICO"), false);
});

test("resolver exige evidencia", () => {
  assert.equal(buscarTransicion("EN_PROGRESO", "RESUELTA").evidencia, "si");
});
