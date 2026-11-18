-- Agrega la proyección de roles/perfiles para el pack DH-02 a una base existente.
-- No elimina las identidades ficticias ni los registros de trabajo de desarrollo.
INSERT INTO asignacion_rol (id, subject, rol, alcance)
SELECT UUID(), datos.subject, datos.rol, datos.alcance
FROM (
  SELECT 'HU-STU-2001' AS subject, 'solicitante' AS rol, NULL AS alcance UNION ALL
  SELECT 'HU-FAC-2101', 'solicitante', NULL UNION ALL
  SELECT 'HU-EMP-2201', 'solicitante', NULL UNION ALL
  SELECT 'HU-EMP-2201', 'coordinador', 'MAIN' UNION ALL
  SELECT 'HU-EMP-2202', 'solicitante', NULL UNION ALL
  SELECT 'HU-EMP-2202', 'supervisor', 'MAIN' UNION ALL
  SELECT 'HU-EMP-2203', 'solicitante', NULL UNION ALL
  SELECT 'HU-EMP-2203', 'representante', 'MAIN-B03' UNION ALL
  SELECT 'SEC-ONCALL', 'solicitante', NULL UNION ALL
  SELECT 'TECH-001', 'tecnico', 'MAIN' UNION ALL
  SELECT 'TECH-002', 'tecnico', 'MAIN' UNION ALL
  SELECT 'TECH-003', 'tecnico', 'MAIN' UNION ALL
  SELECT 'TECH-004', 'tecnico', 'MAIN' UNION ALL
  SELECT 'TECH-005', 'tecnico', 'MAIN' UNION ALL
  SELECT 'TECH-006', 'tecnico', 'MAIN' UNION ALL
  SELECT 'TECH-007', 'tecnico', 'MAIN'
) AS datos
WHERE NOT EXISTS (
  SELECT 1 FROM asignacion_rol existente
  WHERE existente.subject = datos.subject
    AND existente.rol = datos.rol
    AND (existente.alcance <=> datos.alcance)
);

INSERT INTO perfil_tecnico (subject, unidad, disponible, habilitado_restringidas) VALUES
 ('TECH-001', 'FAC-ELEC', TRUE, TRUE),
 ('TECH-002', 'FAC-PLUMB', TRUE, TRUE),
 ('TECH-003', 'FAC-HVAC', TRUE, TRUE),
 ('TECH-004', 'FAC-GENERAL', TRUE, FALSE),
 ('TECH-005', 'FAC-GENERAL', FALSE, FALSE),
 ('TECH-006', 'FAC-GROUNDS', TRUE, FALSE),
 ('TECH-007', 'FAC-HVAC', FALSE, FALSE)
ON DUPLICATE KEY UPDATE
  unidad = VALUES(unidad),
  disponible = VALUES(disponible),
  habilitado_restringidas = VALUES(habilitado_restringidas);
