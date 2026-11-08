function leerUbicacion(recurso) {
  const snapshot = recurso?.ubicacionSnapshot ?? recurso?.ubicacion_snapshot;
  if (!snapshot) {
    const codigo = recurso?.ubicacionCodigo ?? recurso?.ubicacion_codigo ?? recurso?.codigo;
    return codigo ? { campusCodigo: String(codigo).split("-")[0] } : {};
  }
  if (typeof snapshot !== "string") return snapshot;
  try { return JSON.parse(snapshot); } catch { return {}; }
}

function coincideAlcance(rol, ubicacion) {
  const alcance = rol.alcance;
  if (!alcance) return false;
  if (alcance === "*") return true;
  return alcance === ubicacion?.campusCodigo || alcance === ubicacion?.edificioCodigo;
}

export function puedeAccederASolicitud(usuario, solicitud) {
  if (usuario?.subject === solicitud?.afectadoSubject || usuario?.subject === solicitud?.afectado_subject) return true;
  const ubicacion = leerUbicacion(solicitud);
  return usuario?.roles?.some((rol) =>
    ((rol.rol === "coordinador" || rol.rol === "supervisor" || rol.rol === "representante") && coincideAlcance(rol, ubicacion)),
  ) ?? false;
}

export function puedeAdministrarSolicitud(usuario, solicitud, rolesPermitidos = ["coordinador", "supervisor"]) {
  const ubicacion = leerUbicacion(solicitud);
  return usuario?.roles?.some((rol) => rolesPermitidos.includes(rol.rol) && coincideAlcance(rol, ubicacion)) ?? false;
}

export function puedeAccederAOrden(usuario, orden) {
  if (!orden) return false;
  if ([orden.responsableSubject, orden.responsable_subject, orden.afectadoSubject, orden.afectado_subject]
    .includes(usuario?.subject)) return true;
  const ubicacion = leerUbicacion(orden);
  return usuario?.roles?.some((rol) =>
    ((rol.rol === "coordinador" || rol.rol === "supervisor" || rol.rol === "representante") && coincideAlcance(rol, ubicacion)),
  ) ?? false;
}
