import test from "node:test";
import assert from "node:assert/strict";
import {
  puedeAccederAOrden,
  puedeAccederASolicitud,
  puedeAdministrarSolicitud,
} from "../src/modulos/identidad-acceso/autorizacion-recursos.js";

const ubicacionB03 = {
  campusCodigo: "MAIN",
  edificioCodigo: "MAIN-B03",
};

function usuario(subject, rol, alcance = null) {
  return { subject, roles: [{ rol, alcance }] };
}

test("solicitante consulta solo su solicitud y la relación no habilita administración", () => {
  const propia = { afectadoSubject: "HU-1", ubicacionSnapshot: ubicacionB03 };
  const ajena = { afectadoSubject: "HU-2", ubicacionSnapshot: ubicacionB03 };
  const solicitante = usuario("HU-1", "solicitante");

  assert.equal(puedeAccederASolicitud(solicitante, propia), true);
  assert.equal(puedeAccederASolicitud(solicitante, ajena), false);
  assert.equal(puedeAdministrarSolicitud(solicitante, propia, ["coordinador"]), false);
});

test("técnico y contratista acceden a órdenes propias, no a órdenes ajenas", () => {
  const propia = { responsableSubject: "TECH-1", ubicacionSnapshot: ubicacionB03 };
  const ajena = { responsableSubject: "TECH-2", ubicacionSnapshot: ubicacionB03 };

  assert.equal(puedeAccederAOrden(usuario("TECH-1", "tecnico"), propia), true);
  assert.equal(puedeAccederAOrden(usuario("TECH-1", "tecnico"), ajena), false);
  assert.equal(puedeAccederAOrden(usuario("VENDOR-1", "contratista"), propia), false);
  assert.equal(puedeAccederAOrden(usuario("VENDOR-1", "contratista"), { responsableSubject: "VENDOR-1" }), true);
});

test("representante queda limitado al edificio asignado", () => {
  const representante = usuario("HU-REP", "representante", "MAIN-B03");
  const mismoEdificio = { ubicacionSnapshot: ubicacionB03 };
  const otroEdificio = { ubicacionSnapshot: { campusCodigo: "MAIN", edificioCodigo: "MAIN-B04" } };

  assert.equal(puedeAccederAOrden(representante, mismoEdificio), true);
  assert.equal(puedeAccederAOrden(representante, otroEdificio), false);
  assert.equal(puedeAccederASolicitud(representante, otroEdificio), false);
});

test("coordinación administra dentro del campus configurado", () => {
  const coordinador = usuario("HU-COORD", "coordinador", "MAIN");
  assert.equal(puedeAdministrarSolicitud(coordinador, { ubicacionSnapshot: ubicacionB03 }, ["coordinador"]), true);
  assert.equal(puedeAdministrarSolicitud(coordinador, { ubicacionSnapshot: { campusCodigo: "NORTH", edificioCodigo: "NORTH-B01" } }, ["coordinador"]), false);
});
