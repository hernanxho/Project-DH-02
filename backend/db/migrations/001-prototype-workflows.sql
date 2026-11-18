-- Migración aditiva para una base de desarrollo creada antes del flujo de adjuntos y políticas.
-- Ejecutar una sola vez sobre esa base; las bases nuevas ya reciben estos cambios desde schema.sql y seed.sql.

ALTER TABLE adjunto
  ADD COLUMN subido_por VARCHAR(64) NULL AFTER id,
  ADD COLUMN creada_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

INSERT INTO regla_politica (id, clave, version, valor, vigente)
SELECT UUID(), 'niveles_urgencia', 1, JSON_ARRAY('Crítica', 'Alta', 'Normal', 'Baja'), TRUE
WHERE NOT EXISTS (SELECT 1 FROM regla_politica WHERE clave = 'niveles_urgencia' AND version = 1);

INSERT INTO regla_politica (id, clave, version, valor, vigente)
SELECT UUID(), 'ventana_duplicados_horas', 1, JSON_OBJECT('horas', 24), TRUE
WHERE NOT EXISTS (SELECT 1 FROM regla_politica WHERE clave = 'ventana_duplicados_horas' AND version = 1);

INSERT INTO regla_politica (id, clave, version, valor, vigente)
SELECT UUID(), 'alerta_sin_atencion_horas', 1, JSON_OBJECT('horas', 48), TRUE
WHERE NOT EXISTS (SELECT 1 FROM regla_politica WHERE clave = 'alerta_sin_atencion_horas' AND version = 1);

INSERT INTO regla_politica (id, clave, version, valor, vigente)
SELECT UUID(), 'matriz_evidencia', 1, JSON_OBJECT(
  'ASIGNADA->EN_PROGRESO', 'si',
  'EN_PROGRESO->BLOQUEADA_MATERIALES', 'si',
  'EN_PROGRESO->BLOQUEADA_ACCESO', 'si',
  'BLOQUEADA_MATERIALES->EN_PROGRESO', 'opcional',
  'BLOQUEADA_ACCESO->EN_PROGRESO', 'opcional',
  'EN_PROGRESO->RESUELTA', 'si',
  'RESUELTA->EN_PROGRESO', 'no'
), TRUE
WHERE NOT EXISTS (SELECT 1 FROM regla_politica WHERE clave = 'matriz_evidencia' AND version = 1);
