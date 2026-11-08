-- Vincula cada clave de reintento con la ruta y el contenido exacto del comando.
ALTER TABLE comando_procesado ADD COLUMN huella CHAR(64) NULL AFTER actor_subject;
