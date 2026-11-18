-- Roles y perfiles locales enlazados con las identidades y técnicos del pack DH-02.
-- Los roles de coordinación, supervisión y representante son una proyección inicial
-- de actores/relaciones de los escenarios; el equipo debe confirmar su asignación.

INSERT INTO asignacion_rol (id, subject, rol, alcance) VALUES
 (UUID(), 'HU-STU-2001',  'solicitante',   NULL),
 (UUID(), 'HU-FAC-2101',  'solicitante',   NULL),
 (UUID(), 'HU-EMP-2201',  'solicitante',   NULL),
 (UUID(), 'HU-EMP-2201',  'coordinador',   'MAIN'),
 (UUID(), 'HU-EMP-2202',  'solicitante',   NULL),
 (UUID(), 'HU-EMP-2202',  'supervisor',    'MAIN'),
 (UUID(), 'HU-EMP-2203',  'solicitante',   NULL),
 (UUID(), 'HU-EMP-2203',  'representante','MAIN-B03'),
 (UUID(), 'SEC-ONCALL',   'solicitante',   NULL),
 (UUID(), 'TECH-001',     'tecnico',       'MAIN'),
 (UUID(), 'TECH-002',     'tecnico',       'MAIN'),
 (UUID(), 'TECH-003',     'tecnico',       'MAIN'),
 (UUID(), 'TECH-004',     'tecnico',       'MAIN'),
 (UUID(), 'TECH-005',     'tecnico',       'MAIN'),
 (UUID(), 'TECH-006',     'tecnico',       'MAIN'),
 (UUID(), 'TECH-007',     'tecnico',       'MAIN');

INSERT INTO perfil_tecnico (subject, unidad, disponible, habilitado_restringidas) VALUES
 ('TECH-001', 'FAC-ELEC',    TRUE,  TRUE),
 ('TECH-002', 'FAC-PLUMB',   TRUE,  TRUE),
 ('TECH-003', 'FAC-HVAC',    TRUE,  TRUE),
 ('TECH-004', 'FAC-GENERAL', TRUE,  FALSE),
 ('TECH-005', 'FAC-GENERAL', FALSE, FALSE),
 ('TECH-006', 'FAC-GROUNDS', TRUE,  FALSE),
 ('TECH-007', 'FAC-HVAC',    FALSE, FALSE);

-- Política de plazos de cierre (6.9): 72 h de plazo, recordatorios a 24 h y 48 h
INSERT INTO regla_politica (id, clave, version, valor, vigente) VALUES
 (UUID(), 'plazo_cierre_horas',   1, JSON_OBJECT('horas', 72), TRUE),
 (UUID(), 'recordatorios_horas',  1, JSON_ARRAY(24, 48), TRUE),
 (UUID(), 'ventana_reapertura_horas', 1, JSON_OBJECT('horas', 48), TRUE),
 (UUID(), 'alerta_sin_atencion_horas', 1, JSON_OBJECT('horas', 48), TRUE),
 (UUID(), 'niveles_urgencia', 1, JSON_ARRAY('Crítica', 'Alta', 'Normal', 'Baja'), TRUE),
 (UUID(), 'categorias_mantenimiento', 1, JSON_ARRAY(
   JSON_OBJECT('codigo', 'ELECTRICAL', 'nombre', 'Electrical'),
   JSON_OBJECT('codigo', 'PLUMBING', 'nombre', 'Plumbing'),
   JSON_OBJECT('codigo', 'HVAC', 'nombre', 'Air conditioning and ventilation'),
   JSON_OBJECT('codigo', 'CARPENTRY', 'nombre', 'Carpentry and furniture'),
   JSON_OBJECT('codigo', 'DOORS_LOCKS', 'nombre', 'Doors, locks, and windows'),
   JSON_OBJECT('codigo', 'LIGHTING', 'nombre', 'Lighting'),
   JSON_OBJECT('codigo', 'ROOF_WATER', 'nombre', 'Roofs and water infiltration'),
   JSON_OBJECT('codigo', 'SURFACE_REPAIR', 'nombre', 'Painting and surface repair'),
   JSON_OBJECT('codigo', 'CLASSROOM', 'nombre', 'Classroom infrastructure'),
   JSON_OBJECT('codigo', 'LAB_INFRA', 'nombre', 'Laboratory infrastructure'),
   JSON_OBJECT('codigo', 'GROUNDS', 'nombre', 'Grounds and exterior areas'),
   JSON_OBJECT('codigo', 'ACCESSIBILITY', 'nombre', 'Accessibility infrastructure'),
   JSON_OBJECT('codigo', 'GENERAL', 'nombre', 'General building maintenance'),
   JSON_OBJECT('codigo', 'OTHER', 'nombre', 'Other')
 ), TRUE),
 (UUID(), 'ventana_duplicados_horas', 1, JSON_OBJECT('horas', 24), TRUE),
 (UUID(), 'matriz_evidencia', 1, JSON_OBJECT(
   'ASIGNADA->EN_PROGRESO', 'si',
   'EN_PROGRESO->BLOQUEADA_MATERIALES', 'si',
   'EN_PROGRESO->BLOQUEADA_ACCESO', 'si',
   'BLOQUEADA_MATERIALES->EN_PROGRESO', 'opcional',
   'BLOQUEADA_ACCESO->EN_PROGRESO', 'opcional',
   'EN_PROGRESO->RESUELTA', 'si',
   'RESUELTA->EN_PROGRESO', 'no'
 ), TRUE);
