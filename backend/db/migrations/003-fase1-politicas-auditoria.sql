-- Reglas configurables de Fase 1 y protección append-only para auditoría.
INSERT INTO regla_politica (id, clave, version, valor, vigente)
SELECT UUID(), 'categorias_mantenimiento', 1, JSON_ARRAY(
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
), TRUE
WHERE NOT EXISTS (SELECT 1 FROM regla_politica WHERE clave = 'categorias_mantenimiento' AND version = 1);

DELIMITER //
CREATE TRIGGER trg_auditoria_inmutable_update
BEFORE UPDATE ON auditoria FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La auditoria es inmutable';
END//
CREATE TRIGGER trg_auditoria_inmutable_delete
BEFORE DELETE ON auditoria FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La auditoria es inmutable';
END//
DELIMITER ;
