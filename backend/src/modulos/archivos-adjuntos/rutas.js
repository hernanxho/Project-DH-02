import { Router } from "express";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { conTransaccion, pool } from "../../compartido/db.js";
import { config } from "../../compartido/config.js";
import { ErrorApp, noEncontrado, prohibido } from "../../compartido/errores.js";

const MAX_BYTES = 5 * 1024 * 1024;
const EXTENSION = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
export const router = Router();

function detectarMime(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

router.post("/", async (req, res, next) => {
  let archivoPath;
  try {
    const { nombreArchivo, mimeType, contenidoBase64 } = req.body ?? {};
    if (typeof nombreArchivo !== "string" || !nombreArchivo.trim() || nombreArchivo.length > 255) {
      throw new ErrorApp(400, "ARCHIVO_INVALIDO", "Indica un nombre de archivo válido");
    }
    if (!EXTENSION[mimeType]) throw new ErrorApp(400, "TIPO_ARCHIVO_NO_PERMITIDO", "Solo se permiten imágenes JPEG, PNG o WebP");
    if (typeof contenidoBase64 !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(contenidoBase64)) {
      throw new ErrorApp(400, "ARCHIVO_INVALIDO", "El contenido del archivo no está codificado correctamente");
    }
    const bytes = Buffer.from(contenidoBase64, "base64");
    if (!bytes.length || bytes.length > MAX_BYTES) throw new ErrorApp(413, "ARCHIVO_DEMASIADO_GRANDE", "La imagen debe pesar 5 MB o menos");
    if (detectarMime(bytes) !== mimeType) throw new ErrorApp(400, "TIPO_ARCHIVO_INVALIDO", "El contenido no coincide con el tipo de imagen declarado");

    const id = randomUUID();
    const nombreSeguro = `${id}${EXTENSION[mimeType]}`;
    const directorio = path.resolve(config.almacenAdjuntos);
    await mkdir(directorio, { recursive: true });
    archivoPath = path.join(directorio, nombreSeguro);
    await writeFile(archivoPath, bytes, { flag: "wx" });
    try {
      await conTransaccion((conn) => conn.query(
        `INSERT INTO adjunto
          (id, subido_por, nombre_archivo, mime_type, tamano_bytes, ruta_almacen, clasificacion_acceso, creada_en)
         VALUES (?, ?, ?, ?, ?, ?, 'interna', UTC_TIMESTAMP(3))`,
        [id, req.usuario.subject, path.basename(nombreArchivo), mimeType, bytes.length, nombreSeguro],
      ));
    } catch (err) {
      await rm(archivoPath, { force: true });
      throw err;
    }
    res.status(201).json({ id, nombreArchivo: path.basename(nombreArchivo), mimeType, tamanoBytes: bytes.length });
  } catch (err) { next(err); }
});

router.get("/:id", async (req, res, next) => {
  try {
    const [filas] = await pool.query(
      `SELECT a.id, a.subido_por, a.ruta_almacen, a.mime_type,
              a.solicitud_id, a.evidencia_id,
              s.registrada_por, s.afectado_subject, s.ubicacion_snapshot,
              o.responsable_subject
         FROM adjunto a
         LEFT JOIN solicitud s ON s.id = a.solicitud_id
         LEFT JOIN evidencia e ON e.id = a.evidencia_id
         LEFT JOIN orden_trabajo o ON o.id = e.orden_id
        WHERE a.id = ? LIMIT 1`,
      [req.params.id],
    );
    const archivo = filas[0];
    if (!archivo) throw noEncontrado("Archivo no encontrado");
    const roles = req.usuario.roles.map((r) => r.rol);
    const managerial = roles.includes("coordinador") || roles.includes("supervisor");
    let permitido = archivo.subido_por === req.usuario.subject && !archivo.solicitud_id && !archivo.evidencia_id;
    if (managerial || archivo.registrada_por === req.usuario.subject || archivo.afectado_subject === req.usuario.subject || archivo.responsable_subject === req.usuario.subject) permitido = true;
    if (!permitido && archivo.ubicacion_snapshot) {
      let snapshot = archivo.ubicacion_snapshot;
      if (typeof snapshot === "string") {
        try { snapshot = JSON.parse(snapshot); } catch { snapshot = null; }
      }
      permitido = req.usuario.roles.some((r) => r.rol === "representante" && r.alcance === snapshot?.edificioCodigo);
    }
    if (!permitido) throw prohibido("No tienes permiso para consultar este archivo");

    const directorio = path.resolve(config.almacenAdjuntos);
    const ruta = path.resolve(directorio, path.basename(archivo.ruta_almacen));
    res.set("X-Content-Type-Options", "nosniff");
    res.type(archivo.mime_type).sendFile(ruta);
  } catch (err) { next(err); }
});
