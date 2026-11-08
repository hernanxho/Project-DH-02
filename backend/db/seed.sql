-- Datos semilla de desarrollo. Las personas y ubicaciones REALES vienen de los servicios simulados
-- (backend/src/adaptadores); aquí solo van los roles y perfiles locales (ASM-016, ASM-019).
-- Los 'subject' son ficticios y deben coincidir con los de adaptadores/identidad.js.

INSERT INTO asignacion_rol (id, subject, rol, alcance) VALUES
 (UUID(), 'u-solicitante-1', 'solicitante',   NULL),
 (UUID(), 'u-coordinador-1', 'coordinador',   'campus'),
 (UUID(), 'u-supervisor-1',  'supervisor',    'campus'),
 (UUID(), 'u-tecnico-1',     'tecnico',       'campus'),
 (UUID(), 'u-tecnico-2',     'tecnico',       'campus'),
 (UUID(), 'u-representante-1','representante','edificio-A');

INSERT INTO perfil_tecnico (subject, unidad, disponible, habilitado_restringidas) VALUES
 ('u-tecnico-1', 'electricidad', TRUE, TRUE),
 ('u-tecnico-2', 'plomeria',     TRUE, FALSE);

-- Política de plazos de cierre (6.9): 72 h de plazo, recordatorios a 24 h y 48 h
INSERT INTO regla_politica (id, clave, version, valor, vigente) VALUES
 (UUID(), 'plazo_cierre_horas',   1, JSON_OBJECT('horas', 72), TRUE),
 (UUID(), 'recordatorios_horas',  1, JSON_ARRAY(24, 48), TRUE),
 (UUID(), 'ventana_reapertura_horas', 1, JSON_OBJECT('horas', 48), TRUE);
