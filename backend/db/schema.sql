-- Esquema inicial (borrador) derivado de las secciones 6.3 a 6.5 del documento de diseño.
-- Es un punto de partida: el diccionario de datos (6.4) manda sobre este archivo.
-- Motor: MySQL 8 / InnoDB (transacciones y restricciones; E2-ADR-001).

SET NAMES utf8mb4;

-- ---------- Datos de referencia locales ----------
CREATE TABLE asignacion_rol (            -- Identidad y Acceso (5.5)
  id            VARCHAR(36) PRIMARY KEY,
  subject       VARCHAR(64) NOT NULL,
  rol           ENUM('solicitante','coordinador','supervisor','tecnico','representante','contratista') NOT NULL,
  alcance       VARCHAR(64) NULL,        -- p. ej. edificio o unidad
  UNIQUE KEY uq_rol (subject, rol, alcance)
) ENGINE=InnoDB;

CREATE TABLE perfil_tecnico (            -- Órdenes de Trabajo (datos de referencia)
  subject       VARCHAR(64) PRIMARY KEY,
  unidad        VARCHAR(64) NOT NULL,
  disponible    BOOLEAN NOT NULL DEFAULT TRUE,
  habilitado_restringidas BOOLEAN NOT NULL DEFAULT FALSE
) ENGINE=InnoDB;

CREATE TABLE regla_politica (            -- Reglas y Políticas versionadas
  id            VARCHAR(36) PRIMARY KEY,
  clave         VARCHAR(64) NOT NULL,
  version       INT NOT NULL,
  valor         JSON NOT NULL,
  vigente       BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uq_regla (clave, version)
) ENGINE=InnoDB;

-- ---------- Flujo central (6.3) ----------
CREATE TABLE solicitud (
  id                    VARCHAR(36) PRIMARY KEY,
  registrada_por        VARCHAR(64) NOT NULL,
  afectado_subject      VARCHAR(64) NOT NULL,
  canal_origen          VARCHAR(32) NOT NULL DEFAULT 'web',
  ubicacion_codigo      VARCHAR(64) NOT NULL,
  ubicacion_snapshot    JSON NULL,
  ubicacion_verificada  BOOLEAN NOT NULL DEFAULT FALSE,
  categoria_reportada   VARCHAR(64) NOT NULL,
  descripcion           TEXT NOT NULL,
  urgencia_sugerida     VARCHAR(16) NOT NULL,
  urgencia_validada     VARCHAR(16) NULL,
  estado                ENUM('EN_REVISION','VALIDADA','RECHAZADA','CERRADO_DUPLICADO') NOT NULL DEFAULT 'EN_REVISION',
  motivo_rechazo        TEXT NULL,
  solicitud_maestra_id  VARCHAR(36) NULL,
  reabre_orden_id       VARCHAR(36) NULL,
  version               INT NOT NULL DEFAULT 1,   -- control de concurrencia optimista
  creada_en             DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_sol_maestra FOREIGN KEY (solicitud_maestra_id) REFERENCES solicitud(id),
  INDEX ix_sol_estado (estado),
  INDEX ix_sol_ubicacion (ubicacion_codigo, creada_en)   -- sugerencia de duplicados (RF-04)
) ENGINE=InnoDB;

CREATE TABLE orden_trabajo (
  id                   VARCHAR(36) PRIMARY KEY,
  solicitud_id         VARCHAR(36) NOT NULL UNIQUE,     -- una solicitud origina a lo sumo una orden
  orden_padre_id       VARCHAR(36) NULL,
  unidad_responsable   VARCHAR(64) NULL,
  ubicacion_codigo     VARCHAR(64) NOT NULL,
  categoria_original   VARCHAR(64) NOT NULL,
  categoria_actual     VARCHAR(64) NOT NULL,
  prioridad            VARCHAR(16) NOT NULL,
  estado               ENUM('ASIGNADA','EN_PROGRESO','BLOQUEADA_MATERIALES','BLOQUEADA_ACCESO','RESUELTA','CERRADA') NOT NULL,
  responsable_subject  VARCHAR(64) NOT NULL,             -- invariante: toda orden activa tiene responsable
  tipo_responsable     VARCHAR(16) NOT NULL DEFAULT 'tecnico',
  tipo_cierre          ENUM('CONFIRMADO','AUTOMATICO') NULL,
  resuelta_en          DATETIME(3) NULL,
  cerrada_en           DATETIME(3) NULL,
  programada_para      DATETIME(3) NULL,
  version              INT NOT NULL DEFAULT 1,
  creada_en            DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_ord_sol FOREIGN KEY (solicitud_id) REFERENCES solicitud(id),
  CONSTRAINT fk_ord_padre FOREIGN KEY (orden_padre_id) REFERENCES orden_trabajo(id),
  INDEX ix_ord_resp (responsable_subject, estado)
) ENGINE=InnoDB;

ALTER TABLE solicitud
  ADD CONSTRAINT fk_sol_reabre FOREIGN KEY (reabre_orden_id) REFERENCES orden_trabajo(id);

CREATE TABLE asignacion (
  id            VARCHAR(36) PRIMARY KEY,
  orden_id      VARCHAR(36) NOT NULL,
  de_subject    VARCHAR(64) NULL,
  a_subject     VARCHAR(64) NOT NULL,
  tipo          ENUM('INICIAL','TRANSFERENCIA','REASIGNACION') NOT NULL,
  motivo        TEXT NULL,
  asignada_por  VARCHAR(64) NOT NULL,
  asignada_en   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  vigente       BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_asig_ord FOREIGN KEY (orden_id) REFERENCES orden_trabajo(id),
  INDEX ix_asig_orden (orden_id, vigente)
) ENGINE=InnoDB;

CREATE TABLE bloqueo (
  id                VARCHAR(36) PRIMARY KEY,
  orden_id          VARCHAR(36) NOT NULL,
  causal            ENUM('MATERIALES','ACCESO') NOT NULL,
  subcausa          VARCHAR(64) NULL,
  parte_responsable VARCHAR(64) NULL,
  siguiente_accion  TEXT NULL,
  seguimiento_en    DATETIME(3) NULL,
  iniciado_en       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  resuelto_en       DATETIME(3) NULL,
  CONSTRAINT fk_blq_ord FOREIGN KEY (orden_id) REFERENCES orden_trabajo(id)
) ENGINE=InnoDB;

CREATE TABLE evidencia (
  id            VARCHAR(36) PRIMARY KEY,
  orden_id      VARCHAR(36) NOT NULL,
  autor_subject VARCHAR(64) NOT NULL,
  tipo          VARCHAR(32) NOT NULL,
  visibilidad   VARCHAR(16) NOT NULL DEFAULT 'interna',
  resumen       TEXT NULL,
  ocurrida_en   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_evi_ord FOREIGN KEY (orden_id) REFERENCES orden_trabajo(id)
) ENGINE=InnoDB;

CREATE TABLE adjunto (                    -- la base guarda metadatos; el archivo vive en el almacén
  id                   VARCHAR(36) PRIMARY KEY,
  subido_por           VARCHAR(64) NULL,
  evidencia_id         VARCHAR(36) NULL,
  solicitud_id         VARCHAR(36) NULL,
  nombre_archivo       VARCHAR(255) NOT NULL,
  mime_type            VARCHAR(100) NOT NULL,
  tamano_bytes         INT NOT NULL,
  ruta_almacen         VARCHAR(512) NOT NULL,
  clasificacion_acceso VARCHAR(16) NOT NULL DEFAULT 'interna',
  creada_en            DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_adj_evi FOREIGN KEY (evidencia_id) REFERENCES evidencia(id),
  CONSTRAINT fk_adj_sol FOREIGN KEY (solicitud_id) REFERENCES solicitud(id)
) ENGINE=InnoDB;

CREATE TABLE material_usado (
  id                      VARCHAR(36) PRIMARY KEY,
  orden_id                VARCHAR(36) NOT NULL,
  codigo                  VARCHAR(64) NULL,
  descripcion             VARCHAR(255) NOT NULL,
  cantidad                DECIMAL(10,2) NOT NULL,
  unidad                  VARCHAR(16) NOT NULL,
  costo_unitario_estimado DECIMAL(12,2) NULL,
  requiere_compra         BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_mat_ord FOREIGN KEY (orden_id) REFERENCES orden_trabajo(id)
) ENGINE=InnoDB;

CREATE TABLE confirmacion_cierre (
  id                  VARCHAR(36) PRIMARY KEY,
  orden_id            VARCHAR(36) NOT NULL,
  ciclo               INT NOT NULL,
  solicitada_a_subject VARCHAR(64) NOT NULL,
  solicitada_en       DATETIME(3) NOT NULL,
  vence_en            DATETIME(3) NOT NULL,      -- resuelta_en + 72 h
  respuesta           ENUM('CONFIRMADA','RECHAZADA','VENCIDA') NULL,
  respondida_por      VARCHAR(64) NULL,
  respondida_en       DATETIME(3) NULL,
  motivo              TEXT NULL,
  UNIQUE KEY uq_ciclo (orden_id, ciclo),
  CONSTRAINT fk_conf_ord FOREIGN KEY (orden_id) REFERENCES orden_trabajo(id)
) ENGINE=InnoDB;

-- ---------- Auditoría, plazos y entregas (6.5) ----------
CREATE TABLE auditoria (                  -- solo se anexa; sin UPDATE ni DELETE desde la aplicación (ADR-004)
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  entidad       VARCHAR(32) NOT NULL,
  entidad_id    VARCHAR(36) NOT NULL,
  accion        VARCHAR(64) NOT NULL,
  actor_subject VARCHAR(64) NOT NULL,       -- 'SISTEMA' para acciones automáticas
  estado_desde  VARCHAR(32) NULL,
  estado_hasta  VARCHAR(32) NULL,
  detalle       JSON NULL,
  ocurrida_en   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX ix_aud_entidad (entidad, entidad_id, ocurrida_en)
) ENGINE=InnoDB;

CREATE TABLE plazo (                      -- recordatorios y cierre automático procesados por el planificador
  id            VARCHAR(36) PRIMARY KEY,
  orden_id      VARCHAR(36) NOT NULL,
  tipo          ENUM('RECORDATORIO','CIERRE_AUTOMATICO','SEGUIMIENTO_BLOQUEO') NOT NULL,
  vence_en      DATETIME(3) NOT NULL,
  estado        ENUM('PENDIENTE','PROCESADO','CANCELADO') NOT NULL DEFAULT 'PENDIENTE',
  procesado_en  DATETIME(3) NULL,
  CONSTRAINT fk_plz_ord FOREIGN KEY (orden_id) REFERENCES orden_trabajo(id),
  INDEX ix_plazo_pend (estado, vence_en)
) ENGINE=InnoDB;

CREATE TABLE entrega_notificacion (       -- cola de entrega: sobrevive a caídas del servicio simulado (QS-07)
  id            VARCHAR(36) PRIMARY KEY,
  destinatario_subject VARCHAR(64) NOT NULL,
  plantilla     VARCHAR(64) NOT NULL,
  carga         JSON NULL,
  estado        ENUM('PENDIENTE','ENTREGADA','FALLIDA') NOT NULL DEFAULT 'PENDIENTE',
  intentos      INT NOT NULL DEFAULT 0,
  creada_en     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  entregada_en  DATETIME(3) NULL,
  INDEX ix_entrega_pend (estado, creada_en)
) ENGINE=InnoDB;

-- Idempotencia de comandos reenviados desde el campo (QS-06)
CREATE TABLE comando_procesado (
  clave_idempotencia VARCHAR(64) PRIMARY KEY,
  actor_subject      VARCHAR(64) NOT NULL,
  resultado          JSON NULL,
  procesado_en       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;
