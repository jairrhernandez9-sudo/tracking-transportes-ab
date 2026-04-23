-- ============================================================
-- Tracking Logística — Schema completo
-- Última actualización: 2026-04-15
-- Motor: MySQL 8+
-- ============================================================

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- ============================================================
-- TABLA: usuarios
-- ============================================================
DROP TABLE IF EXISTS `usuarios`;
CREATE TABLE `usuarios` (
  `id`               INT           NOT NULL AUTO_INCREMENT,
  `nombre`           VARCHAR(100)  NOT NULL,
  `email`            VARCHAR(100)  NOT NULL,
  `password`         VARCHAR(255)  NOT NULL,
  `rol`              ENUM('admin','operador','cliente','superusuario') DEFAULT 'operador',
  `activo`           TINYINT(1)    DEFAULT '1',
  `fecha_creacion`   TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP,
  `cliente_id`       INT           DEFAULT NULL,
  `pagina_inicio`    VARCHAR(50)   NOT NULL DEFAULT 'dashboard',
  `ultimo_cliente_id` INT          DEFAULT NULL,
  `alias`            VARCHAR(80)   DEFAULT NULL COMMENT 'Nombre público / cargo mostrado al cliente. Si NULL se usa el nombre real.',
  `ultimo_lugar_expedicion` VARCHAR(200) DEFAULT NULL COMMENT 'Último lugar de expedición usado al imprimir la Guía Expedida',
  `sucursal_dir_id` INT DEFAULT NULL COMMENT 'FK a direcciones_cliente — si tiene valor, el usuario solo ve envíos de esa sucursal',
  -- Permisos de vista en detalle de envío (cambio 1)
  `ver_botones_detalle`        TINYINT(1) NOT NULL DEFAULT 1,
  `ver_telefono_detalle`       TINYINT(1) NOT NULL DEFAULT 1,
  `ver_contacto_detalle`       TINYINT(1) NOT NULL DEFAULT 1,
  `ver_editado_por_detalle`    TINYINT(1) NOT NULL DEFAULT 1,
  `ver_panel_estado`           TINYINT(1) NOT NULL DEFAULT 1,
  `ver_comentario_estado`      TINYINT(1) NOT NULL DEFAULT 1,
  `ver_panel_evidencia`        TINYINT(1) NOT NULL DEFAULT 1,
  `ver_comentario_evidencia`   TINYINT(1) NOT NULL DEFAULT 1,
  `ver_acciones_rapidas`            TINYINT(1) NOT NULL DEFAULT 1,
  `ver_actualizado_por_detalle`     TINYINT(1) NOT NULL DEFAULT 1,
  `ver_reimp_por_detalle`           TINYINT(1) NOT NULL DEFAULT 1,
  `auto_activar_cliente`            TINYINT(1) NOT NULL DEFAULT 0,
  -- Columnas visibles en lista de envíos
  `col_folio`                  TINYINT(1) NOT NULL DEFAULT 1,
  `col_tracking`               TINYINT(1) NOT NULL DEFAULT 1,
  `col_referencia`             TINYINT(1) NOT NULL DEFAULT 1,
  `col_cliente`                TINYINT(1) NOT NULL DEFAULT 1,
  `col_origen`                 TINYINT(1) NOT NULL DEFAULT 1,
  `col_destino`                TINYINT(1) NOT NULL DEFAULT 1,
  `col_estado`                 TINYINT(1) NOT NULL DEFAULT 1,
  `col_fecha`                  TINYINT(1) NOT NULL DEFAULT 1,
  `col_autor`                  TINYINT(1) NOT NULL DEFAULT 1,
  -- Campo Documentar a
  `ultimo_documentar`          TINYINT(1) NOT NULL DEFAULT 0,
  `documentar_activo`          TINYINT(1) NOT NULL DEFAULT 0,
  -- Permisos adicionales
  `solo_guias_propias`         TINYINT(1) NOT NULL DEFAULT 0,
  `auto_transito`              TINYINT(1) NOT NULL DEFAULT 0,
  `puede_editar_historial`     TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Operador puede editar fecha/hora en historial de pedido',
  `auto_transito_crear`        TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Al crear guía, agrega automáticamente estado en-transito',
  `historial_acceso`           TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Admin puede ver el módulo Historial de Actividad',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `fk_usuario_cliente` (`cliente_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- ============================================================
-- TABLA: etiqueta_templates
-- Plantillas de visibilidad para etiqueta térmica
-- ============================================================
DROP TABLE IF EXISTS `etiqueta_templates`;
CREATE TABLE `etiqueta_templates` (
  `id`                              INT          NOT NULL AUTO_INCREMENT,
  `nombre`                          VARCHAR(100) NOT NULL,
  -- Visibilidad
  `mostrar_logo`                    TINYINT(1)   NOT NULL DEFAULT 1,
  `mostrar_eslogan`                 TINYINT(1)   NOT NULL DEFAULT 1,
  `mostrar_telefono`                TINYINT(1)   NOT NULL DEFAULT 1,
  `mostrar_telefono_adicional`      TINYINT(1)   NOT NULL DEFAULT 0,
  `mostrar_email`                   TINYINT(1)   NOT NULL DEFAULT 1,
  `mostrar_sitio_web`               TINYINT(1)   NOT NULL DEFAULT 1,
  `mostrar_rfc`                     TINYINT(1)   NOT NULL DEFAULT 1,
  `mostrar_direccion_fiscal`        TINYINT(1)   NOT NULL DEFAULT 0,
  `mostrar_barcode`                 TINYINT(1)   NOT NULL DEFAULT 1,
  `mostrar_qr`                      TINYINT(1)   NOT NULL DEFAULT 1,
  `mostrar_ruta`                    TINYINT(1)   NOT NULL DEFAULT 1,
  `mostrar_descripcion`             TINYINT(1)   NOT NULL DEFAULT 1,
  -- Obligatorio (no se puede ocultar)
  `obligatorio_logo`                TINYINT(1)   NOT NULL DEFAULT 0,
  `obligatorio_eslogan`             TINYINT(1)   NOT NULL DEFAULT 0,
  `obligatorio_telefono`            TINYINT(1)   NOT NULL DEFAULT 0,
  `obligatorio_telefono_adicional`  TINYINT(1)   NOT NULL DEFAULT 0,
  `obligatorio_email`               TINYINT(1)   NOT NULL DEFAULT 0,
  `obligatorio_sitio_web`           TINYINT(1)   NOT NULL DEFAULT 0,
  `obligatorio_rfc`                 TINYINT(1)   NOT NULL DEFAULT 0,
  `obligatorio_direccion_fiscal`    TINYINT(1)   NOT NULL DEFAULT 0,
  `obligatorio_barcode`             TINYINT(1)   NOT NULL DEFAULT 0,
  `obligatorio_qr`                  TINYINT(1)   NOT NULL DEFAULT 0,
  `obligatorio_ruta`                TINYINT(1)   NOT NULL DEFAULT 0,
  `obligatorio_descripcion`         TINYINT(1)   NOT NULL DEFAULT 0,
  -- Visibilidad / Obligatorio — campos Destinatario en etiqueta
  `mostrar_dest_nombre`             TINYINT(1)   NOT NULL DEFAULT 1,
  `mostrar_dest_direccion`          TINYINT(1)   NOT NULL DEFAULT 1,
  `mostrar_dest_referencia`         TINYINT(1)   NOT NULL DEFAULT 1,
  `mostrar_dest_contacto`           TINYINT(1)   NOT NULL DEFAULT 1,
  `mostrar_dest_telefono`           TINYINT(1)   NOT NULL DEFAULT 1,
  `obligatorio_dest_nombre`         TINYINT(1)   NOT NULL DEFAULT 0,
  `obligatorio_dest_direccion`      TINYINT(1)   NOT NULL DEFAULT 0,
  `obligatorio_dest_referencia`     TINYINT(1)   NOT NULL DEFAULT 0,
  `obligatorio_dest_contacto`       TINYINT(1)   NOT NULL DEFAULT 0,
  `obligatorio_dest_telefono`       TINYINT(1)   NOT NULL DEFAULT 0,
  -- Alias de sucursal en banda de ruta
  `mostrar_alias_ruta`              TINYINT(1)   NOT NULL DEFAULT 0,
  `obligatorio_alias_ruta`          TINYINT(1)   NOT NULL DEFAULT 0,
  -- Peso total de guía y peso por ítem
  `mostrar_peso_total`              TINYINT(1)   NOT NULL DEFAULT 1,
  `obligatorio_peso_total`          TINYINT(1)   NOT NULL DEFAULT 0,
  `mostrar_peso_item`               TINYINT(1)   NOT NULL DEFAULT 0,
  `obligatorio_peso_item`           TINYINT(1)   NOT NULL DEFAULT 0,
  -- Textos editables por template
  `texto_fecha_emision`             VARCHAR(100) NULL COMMENT 'Label "Fecha emisión" en header',
  `texto_etiqueta`                  VARCHAR(50)  NULL COMMENT 'Label "Etiqueta" (contador X/Y) en header',
  `texto_entregar_a`                VARCHAR(100) NULL COMMENT 'Label de la sección "Entregar a:"',
  `texto_peso`                      VARCHAR(50)  NULL COMMENT 'Label del campo Peso total',
  `texto_peso_item`                 VARCHAR(50)  NULL COMMENT 'Label del campo Peso por ítem',
  `texto_entrega_estimada`          VARCHAR(100) NULL COMMENT 'Label del campo Entrega estimada',
  `texto_ref_cliente`               VARCHAR(100) NULL COMMENT 'Label del campo Ref. cliente',
  `texto_descripcion`               VARCHAR(100) NULL COMMENT 'Label de la sección Descripción / Contenido',
  -- Tamaños de fuente (px). NULL = usar default del CSS
  `size_tracking`                   TINYINT UNSIGNED NULL,
  `size_ruta_ciudad`                TINYINT UNSIGNED NULL,
  `size_dest_nombre`                TINYINT UNSIGNED NULL,
  `size_dest_direccion`             TINYINT UNSIGNED NULL,
  `size_empresa_nombre`             TINYINT UNSIGNED NULL,
  `size_eslogan`                    TINYINT UNSIGNED NULL,
  `size_tipo_servicio`              TINYINT UNSIGNED NULL,
  `size_detalle_valor`              TINYINT UNSIGNED NULL,
  `size_descripcion`                TINYINT UNSIGNED NULL,
  `size_dest_contacto`              TINYINT UNSIGNED NULL,
  `size_barra_contacto`             TINYINT UNSIGNED NULL,
  `size_ruta_etiqueta`              TINYINT UNSIGNED NULL,
  `size_detalle_etiqueta`           TINYINT UNSIGNED NULL,
  `size_cab_fecha`                  TINYINT UNSIGNED NULL,
  `size_cab_num`                    TINYINT UNSIGNED NULL,
  `bloqueado`                       TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'Solo admin puede modificar toggles cuando está bloqueado',
  `creado_por`                      INT          NULL,
  `created_at`                      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_etpl_creado_por` (`creado_por`),
  CONSTRAINT `etiqueta_templates_ibfk_1` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLA: guia_templates
-- Plantillas de visibilidad para Guía Expedida (Carta Porte)
-- ============================================================
DROP TABLE IF EXISTS `guia_templates`;
CREATE TABLE `guia_templates` (
  `id`                              INT          NOT NULL AUTO_INCREMENT,
  `nombre`                          VARCHAR(100) NOT NULL,
  -- Visibilidad — encabezado
  `mostrar_logo`                    TINYINT(1)   DEFAULT 1,
  `mostrar_rfc`                     TINYINT(1)   DEFAULT 1,
  `mostrar_telefono`                TINYINT(1)   DEFAULT 1,
  `mostrar_sitio_web`               TINYINT(1)   DEFAULT 1,
  `mostrar_barcode`                 TINYINT(1)   DEFAULT 1,
  -- Visibilidad — secciones principales
  `mostrar_seccion_remitente`       TINYINT(1)   DEFAULT 1,
  `mostrar_seccion_facturar`        TINYINT(1)   DEFAULT 1,
  `mostrar_seccion_destinatario`    TINYINT(1)   DEFAULT 1,
  -- Visibilidad — condiciones / fechas
  `mostrar_clausula_seguro`         TINYINT(1)   DEFAULT 1,
  `mostrar_retorno_documentos`      TINYINT(1)   DEFAULT 1,
  `mostrar_condiciones_pago`        TINYINT(1)   DEFAULT 1,
  `mostrar_fecha_emision`           TINYINT(1)   DEFAULT 1,
  `mostrar_observaciones`           TINYINT(1)   DEFAULT 1,
  `mostrar_fecha_entrega`           TINYINT(1)   DEFAULT 1,
  `mostrar_referencia_cliente`      TINYINT(1)   DEFAULT 1,
  -- Visibilidad — entrega / firma
  `mostrar_recibido_por`            TINYINT(1)   DEFAULT 1,
  `mostrar_operador`                TINYINT(1)   DEFAULT 1,
  `mostrar_firma_final`             TINYINT(1)   DEFAULT 1,
  -- Visibilidad — pie
  `mostrar_pie_datos`               TINYINT(1)   DEFAULT 1,
  `mostrar_disclaimer`              TINYINT(1)   DEFAULT 1,
  -- Visibilidad — columnas de tabla
  `mostrar_col_volumen`             TINYINT(1)   DEFAULT 1,
  `mostrar_col_peso_facturado`      TINYINT(1)   DEFAULT 1,
  `mostrar_col_servicios`           TINYINT(1)   DEFAULT 1,
  `mostrar_col_importe`             TINYINT(1)   DEFAULT 1,
  -- Obligatorio (no se puede ocultar) — encabezado
  `obligatorio_logo`                TINYINT(1)   DEFAULT 0,
  `obligatorio_rfc`                 TINYINT(1)   DEFAULT 0,
  `obligatorio_telefono`            TINYINT(1)   DEFAULT 0,
  `obligatorio_sitio_web`           TINYINT(1)   DEFAULT 0,
  `obligatorio_barcode`             TINYINT(1)   DEFAULT 0,
  -- Obligatorio — secciones principales
  `obligatorio_seccion_remitente`   TINYINT(1)   DEFAULT 0,
  `obligatorio_seccion_facturar`    TINYINT(1)   DEFAULT 0,
  `obligatorio_seccion_destinatario` TINYINT(1)  DEFAULT 0,
  -- Obligatorio — condiciones / fechas
  `obligatorio_clausula_seguro`     TINYINT(1)   DEFAULT 0,
  `obligatorio_retorno_documentos`  TINYINT(1)   DEFAULT 0,
  `obligatorio_condiciones_pago`    TINYINT(1)   DEFAULT 0,
  `obligatorio_fecha_emision`       TINYINT(1)   DEFAULT 0,
  `obligatorio_observaciones`       TINYINT(1)   DEFAULT 0,
  `obligatorio_fecha_entrega`       TINYINT(1)   DEFAULT 0,
  `obligatorio_referencia_cliente`  TINYINT(1)   DEFAULT 0,
  -- Obligatorio — entrega / firma
  `obligatorio_recibido_por`        TINYINT(1)   DEFAULT 0,
  `obligatorio_operador`            TINYINT(1)   DEFAULT 0,
  `obligatorio_firma_final`         TINYINT(1)   DEFAULT 0,
  -- Obligatorio — pie
  `obligatorio_pie_datos`           TINYINT(1)   DEFAULT 0,
  `obligatorio_disclaimer`          TINYINT(1)   DEFAULT 0,
  -- Obligatorio — columnas de tabla
  `obligatorio_col_volumen`         TINYINT(1)   DEFAULT 0,
  `obligatorio_col_peso_facturado`  TINYINT(1)   DEFAULT 0,
  `obligatorio_col_servicios`       TINYINT(1)   DEFAULT 0,
  `obligatorio_col_importe`         TINYINT(1)   DEFAULT 0,
  -- Visibilidad — sub-campos Remitente
  `mostrar_remitente_nombre`        TINYINT(1)   DEFAULT 1,
  `mostrar_remitente_direccion`     TINYINT(1)   DEFAULT 1,
  `mostrar_remitente_telefono`      TINYINT(1)   DEFAULT 1,
  -- Visibilidad — sub-campos Facturar a
  `mostrar_facturar_nombre`         TINYINT(1)   DEFAULT 1,
  `mostrar_facturar_direccion`      TINYINT(1)   DEFAULT 1,
  `mostrar_facturar_contacto`       TINYINT(1)   DEFAULT 1,
  `mostrar_facturar_telefono`       TINYINT(1)   DEFAULT 1,
  `mostrar_facturar_email`          TINYINT(1)   DEFAULT 1,
  `mostrar_facturar_rfc`            TINYINT(1)   DEFAULT 1,
  -- Visibilidad — sub-campos Destinatario
  `mostrar_destinatario_nombre`     TINYINT(1)   DEFAULT 1,
  `mostrar_destinatario_direccion`  TINYINT(1)   DEFAULT 1,
  -- Obligatorio — sub-campos Remitente
  `obligatorio_remitente_nombre`    TINYINT(1)   DEFAULT 0,
  `obligatorio_remitente_direccion` TINYINT(1)   DEFAULT 0,
  `obligatorio_remitente_telefono`  TINYINT(1)   DEFAULT 0,
  -- Obligatorio — sub-campos Facturar a
  `obligatorio_facturar_nombre`     TINYINT(1)   DEFAULT 0,
  `obligatorio_facturar_direccion`  TINYINT(1)   DEFAULT 0,
  `obligatorio_facturar_contacto`   TINYINT(1)   DEFAULT 0,
  `obligatorio_facturar_telefono`   TINYINT(1)   DEFAULT 0,
  `obligatorio_facturar_email`      TINYINT(1)   DEFAULT 0,
  `obligatorio_facturar_rfc`        TINYINT(1)   DEFAULT 0,
  -- Obligatorio — sub-campos Destinatario
  `obligatorio_destinatario_nombre`    TINYINT(1) DEFAULT 0,
  `obligatorio_destinatario_direccion` TINYINT(1) DEFAULT 0,
  -- Visibilidad — sección observaciones en entrega
  `mostrar_obs_operador`            TINYINT(1)   DEFAULT 1,
  `obligatorio_obs_operador`        TINYINT(1)   DEFAULT 0,
  `mostrar_obs_recibido`            TINYINT(1)   DEFAULT 1,
  `obligatorio_obs_recibido`        TINYINT(1)   DEFAULT 0,
  -- Textos editables por template
  `descripcion_servicio`            VARCHAR(200) NULL COMMENT 'Subtítulo en encabezado (ej: Servicio de transportes de Carga)',
  `titulo_guia`                     VARCHAR(100) NULL COMMENT 'Título principal (ej: GUÍA EXPEDIDA, ENVÍO FORÁNEO, ENVÍO NACIONAL)',
  `mensaje_1`                       TEXT         NULL COMMENT 'Mensaje cláusula 1 (después de tabla de carga)',
  `mensaje_2`                       TEXT         NULL COMMENT 'Mensaje cláusula 2 (después de cláusula 1)',
  `mensaje_3`                       TEXT         NULL COMMENT 'Condiciones (antes del pie de página)',
  `mensaje_4`                       TEXT         NULL COMMENT 'Mensaje al final del documento (después del disclaimer)',
  `etiqueta_col_descripcion`        VARCHAR(200) NULL COMMENT 'Encabezado columna descripción en tabla de carga',
  `etiqueta_operador`               VARCHAR(200) NULL COMMENT 'Etiqueta sección Operador que entregó',
  `etiqueta_obs_operador`           VARCHAR(200) NULL COMMENT 'Etiqueta columna Observaciones (lado operador)',
  `etiqueta_recibido_por`           VARCHAR(200) NULL COMMENT 'Etiqueta sección Recibido por',
  `etiqueta_obs_recibido`           VARCHAR(200) NULL COMMENT 'Etiqueta columna Observaciones (lado recibido)',
  -- Tamaños de fuente (pt). NULL = usar default del CSS
  `size_guia_titulo`                TINYINT UNSIGNED NULL,
  `size_tracking_big`               TINYINT UNSIGNED NULL,
  `size_company_name`               TINYINT UNSIGNED NULL,
  `size_seccion_content`            TINYINT UNSIGNED NULL,
  `size_cargo_td`                   TINYINT UNSIGNED NULL,
  `size_guia_servicio`              TINYINT UNSIGNED NULL,
  `size_seccion_label`              TINYINT UNSIGNED NULL,
  `size_cargo_th`                   TINYINT UNSIGNED NULL,
  `size_footer_content`             TINYINT UNSIGNED NULL,
  `size_pago_big`                   TINYINT UNSIGNED NULL,
  `size_msg_row`                    TINYINT UNSIGNED NULL,
  `height_obs_tall`                 SMALLINT UNSIGNED NULL COMMENT 'Alto mínimo secciones firma (px)',
  `bloqueado`                       TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'Solo admin puede modificar toggles cuando está bloqueado',
  `creado_por`                      INT          NULL,
  `creado_en`                       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_gtpl_creado_por` (`creado_por`),
  CONSTRAINT `guia_templates_ibfk_1` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLA: clientes
-- ============================================================
DROP TABLE IF EXISTS `clientes`;
CREATE TABLE `clientes` (
  `id`                      INT           NOT NULL AUTO_INCREMENT,
  `nombre_empresa`          VARCHAR(150)  NOT NULL,
  `contacto`                VARCHAR(100)  DEFAULT NULL,
  `telefono`                VARCHAR(20)   DEFAULT NULL,
  `email`                   VARCHAR(100)  DEFAULT NULL,
  `direccion`               TEXT,
  `fecha_creacion`          TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP,
  `activo`                  TINYINT(1)    DEFAULT '1',
  `habilitado`              TINYINT(1)    DEFAULT '1',
  `prefijo_tracking`        VARCHAR(10)   NOT NULL DEFAULT 'TRK',
  `ultimo_numero_tracking`  INT UNSIGNED  NOT NULL DEFAULT '0',
  `eliminado_en`            DATETIME      DEFAULT NULL,
  `template_etiqueta_id`    INT           NULL COMMENT 'FK a etiqueta_templates',
  `template_guia_id`        INT           NULL COMMENT 'FK a guia_templates',
  `metodo_pago_defecto`     VARCHAR(3)    NOT NULL DEFAULT 'PPD' COMMENT 'PUE o PPD (SAT)',
  `logo_url`                VARCHAR(500)  NULL COMMENT 'Logo del cliente mostrado en el portal',
  `ocultar_fecha`           TINYINT(1)    NOT NULL DEFAULT 0 COMMENT 'Oculta la fecha del historial en portal y tracking público',
  `ocultar_hora`            TINYINT(1)    NOT NULL DEFAULT 0 COMMENT 'Oculta la hora del historial en portal y tracking público',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_prefijo_tracking` (`prefijo_tracking`),
  KEY `fk_cliente_etpl` (`template_etiqueta_id`),
  KEY `fk_cliente_gtpl` (`template_guia_id`),
  CONSTRAINT `clientes_ibfk_etpl` FOREIGN KEY (`template_etiqueta_id`) REFERENCES `etiqueta_templates` (`id`) ON DELETE SET NULL,
  CONSTRAINT `clientes_ibfk_gtpl` FOREIGN KEY (`template_guia_id`)     REFERENCES `guia_templates`    (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- ============================================================
-- TABLA: configuracion_sistema
-- ============================================================
DROP TABLE IF EXISTS `configuracion_sistema`;
CREATE TABLE `configuracion_sistema` (
  `id`                  INT           NOT NULL AUTO_INCREMENT,
  `clave`               VARCHAR(100)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `valor`               TEXT          CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `tipo`                ENUM('texto','numero','boolean','json') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'texto',
  `categoria`           VARCHAR(50)   CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `descripcion`         TEXT          CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `fecha_modificacion`  TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `modificado_por`      INT           DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `clave` (`clave`),
  KEY `modificado_por` (`modificado_por`),
  CONSTRAINT `configuracion_sistema_ibfk_1` FOREIGN KEY (`modificado_por`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Datos iniciales: botones de fecha rápida
INSERT INTO `configuracion_sistema` (`clave`, `valor`, `tipo`, `categoria`, `descripcion`) VALUES
  ('fecha_rapida_manana',   'true',  'boolean', 'envios', 'Botón fecha rápida: Mañana'),
  ('fecha_rapida_2dias',    'true',  'boolean', 'envios', 'Botón fecha rápida: 2 días'),
  ('fecha_rapida_3dias',    'true',  'boolean', 'envios', 'Botón fecha rápida: 3 días'),
  ('fecha_rapida_hoy',      'true',  'boolean', 'envios', 'Botón fecha rápida: HOY (advertencia)'),
  ('fecha_rapida_1semana',  'false', 'boolean', 'envios', 'Botón fecha rápida: 1 semana'),
  ('fecha_rapida_2semanas', 'false', 'boolean', 'envios', 'Botón fecha rápida: 2 semanas'),
  ('fecha_rapida_custom',   '[]',    'json',    'envios', 'Botones de fecha rápida personalizados');

-- Datos iniciales: historial de actividad
INSERT INTO `configuracion_sistema` (`clave`, `valor`, `tipo`, `categoria`, `descripcion`) VALUES
  ('historial_actividad_activo', 'true', 'boolean', 'sistema', 'Activa o desactiva el módulo Historial de Actividad para todos');

-- Datos iniciales: configuración adicional
INSERT INTO `configuracion_sistema` (`clave`, `valor`, `tipo`, `categoria`, `descripcion`) VALUES
  ('credito_habilitado',        'true',  'boolean', 'tarifas',  'Habilitar pago por crédito'),
  ('documentar_activo',         'true',  'boolean', 'empresa',  'Habilitar campo Documentar en creación de guías'),
  ('etiqueta_mostrar_contacto', 'false', 'boolean', 'etiqueta', 'Toggle etiqueta_mostrar_contacto');


-- ============================================================
-- TABLA: direcciones_cliente
-- Direcciones frecuentes guardadas por cliente
-- ============================================================
DROP TABLE IF EXISTS `direcciones_cliente`;
CREATE TABLE `direcciones_cliente` (
  `id`                  INT           NOT NULL AUTO_INCREMENT,
  `cliente_id`          INT           NOT NULL,
  `alias`               VARCHAR(100)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre descriptivo',
  `tipo`                ENUM('origen','destino','ambos') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ambos',
  `calle`               VARCHAR(255)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `colonia`             VARCHAR(100)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `ciudad`              VARCHAR(100)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `estado`              VARCHAR(50)   CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `cp`                  VARCHAR(5)    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `referencia`          VARCHAR(255)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `es_predeterminada`   TINYINT(1)    DEFAULT '0',
  `activa`              TINYINT(1)    DEFAULT '1',
  `fecha_creacion`      TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cliente_id` (`cliente_id`),
  KEY `idx_tipo` (`tipo`),
  KEY `idx_activa` (`activa`),
  CONSTRAINT `direcciones_cliente_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Direcciones frecuentes por cliente';


-- ============================================================
-- TABLA: direcciones_empresa
-- Bodegas / almacenes de la empresa
-- ============================================================
DROP TABLE IF EXISTS `direcciones_empresa`;
CREATE TABLE `direcciones_empresa` (
  `id`                  INT           NOT NULL AUTO_INCREMENT,
  `alias`               VARCHAR(100)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Bodega Central, Almacén Norte, etc.',
  `tipo`                ENUM('origen','destino','ambos') NOT NULL DEFAULT 'origen' COMMENT 'origen=bodega, destino=universal, ambos=ambos usos',
  `calle`               VARCHAR(255)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `colonia`             VARCHAR(100)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `ciudad`              VARCHAR(100)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `estado`              VARCHAR(50)   CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `cp`                  VARCHAR(5)    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `referencia`          VARCHAR(255)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `es_predeterminada`   TINYINT(1)    DEFAULT '0',
  `activa`              TINYINT(1)    DEFAULT '1',
  `fecha_creacion`      TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_alias_unico` (`alias`),
  KEY `idx_activa` (`activa`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Direcciones de la empresa (bodegas origen)';


-- ============================================================
-- TABLA: envios
-- ============================================================
DROP TABLE IF EXISTS `envios`;
CREATE TABLE `envios` (
  `id`                      INT           NOT NULL AUTO_INCREMENT,
  `numero_tracking`         VARCHAR(50)   NOT NULL,
  `referencia_cliente`      VARCHAR(100)  DEFAULT NULL,
  `cliente_id`              INT           DEFAULT NULL,
  `cliente_nombre`          VARCHAR(255)  DEFAULT NULL,
  -- Dirección de origen (resumen + desglosada)
  `origen`                  VARCHAR(200)  NOT NULL,
  `origen_calle`            VARCHAR(255)  DEFAULT NULL,
  `origen_colonia`          VARCHAR(100)  DEFAULT NULL,
  `origen_ciudad`           VARCHAR(100)  DEFAULT NULL,
  `origen_estado`           VARCHAR(50)   DEFAULT NULL,
  `origen_cp`               VARCHAR(5)    DEFAULT NULL,
  `origen_referencia`       VARCHAR(255)  DEFAULT NULL,
  -- Dirección de destino (resumen + desglosada)
  `destino`                 VARCHAR(200)  NOT NULL,
  `destino_calle`           VARCHAR(255)  DEFAULT NULL,
  `destino_colonia`         VARCHAR(100)  DEFAULT NULL,
  `destino_ciudad`          VARCHAR(100)  DEFAULT NULL,
  `destino_estado`          VARCHAR(50)   DEFAULT NULL,
  `destino_cp`              VARCHAR(5)    DEFAULT NULL,
  `destino_referencia`      VARCHAR(255)  DEFAULT NULL,
  -- Datos del envío
  `descripcion`             TEXT,
  `peso`                    DECIMAL(10,2) DEFAULT NULL,
  `estado_actual`           VARCHAR(50)   DEFAULT 'creado',
  `fecha_creacion`          TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_estimada_entrega`  DATE          DEFAULT NULL,
  `usuario_creador_id`      INT           DEFAULT NULL,
  -- Envíos parciales / complementarios
  `es_parcial`              TINYINT(1)    NOT NULL DEFAULT '0',
  `envio_relacionado_id`    INT           DEFAULT NULL,
  `es_complemento`          TINYINT(1)    NOT NULL DEFAULT '0',
  `numero_parte`            INT           DEFAULT NULL,
  -- Etiqueta / Pago
  `etiqueta_modificada`     TINYINT(1)    NOT NULL DEFAULT '0',
  -- Pago (SAT: PUE = contado, PPD = crédito)
  `metodo_pago`             VARCHAR(3)    NOT NULL DEFAULT 'PPD' COMMENT 'PUE o PPD (SAT). Copiado del cliente al crear el envío.',
  -- Auditoría
  `editado_por_nombre`      VARCHAR(150)  DEFAULT NULL,
  -- Campo Documentar a (dirección alternativa de entrega)
  `documentar_nombre`       VARCHAR(200)  DEFAULT NULL,
  `documentar_calle`        VARCHAR(200)  DEFAULT NULL,
  `documentar_colonia`      VARCHAR(150)  DEFAULT NULL,
  `documentar_cp`           VARCHAR(10)   DEFAULT NULL,
  `documentar_ciudad`       VARCHAR(150)  DEFAULT NULL,
  `documentar_estado`       VARCHAR(100)  DEFAULT NULL,
  `documentar_referencia`   VARCHAR(200)  DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `numero_tracking` (`numero_tracking`),
  KEY `cliente_id` (`cliente_id`),
  KEY `usuario_creador_id` (`usuario_creador_id`),
  KEY `idx_numero_tracking` (`numero_tracking`),
  KEY `fk_envio_relacionado` (`envio_relacionado_id`),
  CONSTRAINT `envios_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`),
  CONSTRAINT `envios_ibfk_2` FOREIGN KEY (`usuario_creador_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_envio_relacionado` FOREIGN KEY (`envio_relacionado_id`) REFERENCES `envios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- ============================================================
-- TABLA: envio_items
-- Líneas de mercancía de un envío
-- ============================================================
DROP TABLE IF EXISTS `envio_items`;
CREATE TABLE `envio_items` (
  `id`          INT           NOT NULL AUTO_INCREMENT,
  `envio_id`    INT           NOT NULL,
  `cantidad`    INT           NOT NULL DEFAULT '1',
  `tipo`        VARCHAR(100)  NOT NULL,
  `descripcion` VARCHAR(255)  DEFAULT NULL,
  `peso`        DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id`),
  KEY `envio_id` (`envio_id`),
  CONSTRAINT `envio_items_ibfk_1` FOREIGN KEY (`envio_id`) REFERENCES `envios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- ============================================================
-- TABLA: historial_estados
-- ============================================================
DROP TABLE IF EXISTS `historial_estados`;
CREATE TABLE `historial_estados` (
  `id`             INT          NOT NULL AUTO_INCREMENT,
  `envio_id`       INT          NOT NULL,
  `estado`         VARCHAR(50)  NOT NULL,
  `ubicacion`      VARCHAR(200) DEFAULT NULL,
  `comentarios`    TEXT,
  `foto_evidencia` VARCHAR(255) DEFAULT NULL,
  `fecha_hora`     TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP,
  `usuario_id`     INT          DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `envio_id` (`envio_id`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `historial_estados_ibfk_1` FOREIGN KEY (`envio_id`)   REFERENCES `envios`    (`id`) ON DELETE CASCADE,
  CONSTRAINT `historial_estados_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`  (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- ============================================================
-- TABLA: fotos_evidencia
-- ============================================================
DROP TABLE IF EXISTS `fotos_evidencia`;
CREATE TABLE `fotos_evidencia` (
  `id`                   INT          NOT NULL AUTO_INCREMENT,
  `historial_estado_id`  INT          NOT NULL,
  `url_foto`             VARCHAR(500) NOT NULL,
  `descripcion`          TEXT,
  `fecha_subida`         TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `historial_estado_id` (`historial_estado_id`),
  CONSTRAINT `fotos_evidencia_ibfk_1` FOREIGN KEY (`historial_estado_id`) REFERENCES `historial_estados` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- ============================================================
-- ============================================================
-- TABLA: pictogramas
-- Símbolos de peligro / manejo subidos por el admin
-- ============================================================
DROP TABLE IF EXISTS `pictogramas`;
CREATE TABLE `pictogramas` (
  `id`          INT           NOT NULL AUTO_INCREMENT,
  `nombre`      VARCHAR(100)  NOT NULL,
  `imagen_url`  VARCHAR(500)  NOT NULL COMMENT 'Ruta pública ej: /uploads/pictogramas/hazmat.png',
  `orden`       INT           NULL DEFAULT 0 COMMENT 'Para ordenar en la vista',
  `activo`      TINYINT(1)    NULL DEFAULT 1,
  `creado_en`   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  `creado_por`  INT           NULL,
  PRIMARY KEY (`id`),
  KEY `fk_picto_creado` (`creado_por`),
  CONSTRAINT `fk_picto_creado` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Símbolos de peligro/manejo para imprimir en etiqueta';


-- ============================================================
-- TABLA: envio_pictogramas
-- Pivote muchos-a-muchos envío ↔ pictograma
-- ============================================================
DROP TABLE IF EXISTS `envio_pictogramas`;
CREATE TABLE `envio_pictogramas` (
  `envio_id`       INT  NOT NULL,
  `pictograma_id`  INT  NOT NULL,
  PRIMARY KEY (`envio_id`, `pictograma_id`),
  KEY `fk_ep_picto` (`pictograma_id`),
  CONSTRAINT `fk_ep_envio`  FOREIGN KEY (`envio_id`)      REFERENCES `envios`      (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ep_picto`  FOREIGN KEY (`pictograma_id`) REFERENCES `pictogramas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLA: cliente_operadores
-- Asignación de operadores a clientes (muchos a muchos)
-- El operador solo puede ver/operar los clientes asignados
-- ============================================================
DROP TABLE IF EXISTS `cliente_operadores`;
CREATE TABLE `cliente_operadores` (
  `cliente_id`  INT NOT NULL,
  `usuario_id`  INT NOT NULL,
  PRIMARY KEY (`cliente_id`, `usuario_id`),
  KEY `fk_co_usuario` (`usuario_id`),
  CONSTRAINT `fk_co_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes`  (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_co_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`  (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Operadores asignados a cada cliente; restringe lista de clientes y envíos visibles al operador';


-- ============================================================
-- TABLA: tipos_empaques
-- Catálogo editable de tipos de empaque para ítems de envío
-- ============================================================
DROP TABLE IF EXISTS `tipos_empaques`;
CREATE TABLE `tipos_empaques` (
  `id`         INT           NOT NULL AUTO_INCREMENT,
  `nombre`     VARCHAR(100)  NOT NULL,
  `activo`     TINYINT(1)    NULL DEFAULT 1,
  `orden`      INT           NULL DEFAULT 0,
  `creado_en`  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tipo_empaque_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Catálogo de tipos de empaque para ítems de envío';

INSERT INTO `tipos_empaques` (`nombre`, `orden`) VALUES
  ('BULTOS',    1),
  ('TARIMA',    2),
  ('BOTES',     3),
  ('CAJA',      4),
  ('PALLET',    5),
  ('PROTEGIDO', 6);


-- ============================================================
-- Multi-sucursal por usuario cliente
-- ============================================================
CREATE TABLE IF NOT EXISTS `usuario_sucursales` (
  `usuario_id`      INT NOT NULL,
  `sucursal_dir_id` INT NOT NULL,
  PRIMARY KEY (`usuario_id`, `sucursal_dir_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Config de guía impresa por envío
-- ============================================================
CREATE TABLE IF NOT EXISTS `guias_config_impresa` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `envio_id` INT NOT NULL,
  `mostrar_logo` TINYINT(1) DEFAULT 1,
  `mostrar_rfc` TINYINT(1) DEFAULT 1,
  `mostrar_telefono` TINYINT(1) DEFAULT 1,
  `mostrar_sitio_web` TINYINT(1) DEFAULT 1,
  `mostrar_barcode` TINYINT(1) DEFAULT 1,
  `mostrar_seccion_remitente` TINYINT(1) DEFAULT 1,
  `mostrar_remitente_nombre` TINYINT(1) DEFAULT 1,
  `mostrar_remitente_direccion` TINYINT(1) DEFAULT 1,
  `mostrar_remitente_telefono` TINYINT(1) DEFAULT 1,
  `mostrar_seccion_facturar` TINYINT(1) DEFAULT 1,
  `mostrar_facturar_nombre` TINYINT(1) DEFAULT 1,
  `mostrar_facturar_direccion` TINYINT(1) DEFAULT 1,
  `mostrar_facturar_contacto` TINYINT(1) DEFAULT 1,
  `mostrar_facturar_telefono` TINYINT(1) DEFAULT 1,
  `mostrar_facturar_email` TINYINT(1) DEFAULT 1,
  `mostrar_facturar_rfc` TINYINT(1) DEFAULT 1,
  `mostrar_seccion_destinatario` TINYINT(1) DEFAULT 1,
  `mostrar_destinatario_nombre` TINYINT(1) DEFAULT 1,
  `mostrar_destinatario_direccion` TINYINT(1) DEFAULT 1,
  `mostrar_clausula_seguro` TINYINT(1) DEFAULT 1,
  `mostrar_observaciones` TINYINT(1) DEFAULT 1,
  `mostrar_condiciones_pago` TINYINT(1) DEFAULT 1,
  `mostrar_fecha_emision` TINYINT(1) DEFAULT 1,
  `mostrar_fecha_entrega` TINYINT(1) DEFAULT 1,
  `mostrar_referencia_cliente` TINYINT(1) DEFAULT 1,
  `mostrar_retorno_documentos` TINYINT(1) DEFAULT 1,
  `mostrar_operador` TINYINT(1) DEFAULT 1,
  `mostrar_obs_operador` TINYINT(1) DEFAULT 1,
  `mostrar_recibido_por` TINYINT(1) DEFAULT 1,
  `mostrar_obs_recibido` TINYINT(1) DEFAULT 1,
  `mostrar_firma_final` TINYINT(1) DEFAULT 1,
  `mostrar_col_volumen` TINYINT(1) DEFAULT 1,
  `mostrar_col_peso_facturado` TINYINT(1) DEFAULT 1,
  `mostrar_col_servicios` TINYINT(1) DEFAULT 1,
  `mostrar_col_importe` TINYINT(1) DEFAULT 1,
  `mostrar_pie_datos` TINYINT(1) DEFAULT 1,
  `mostrar_disclaimer` TINYINT(1) DEFAULT 1,
  `activa`            TINYINT(1)   NOT NULL DEFAULT 1,
  `presentado_portal` TINYINT(1)   NOT NULL DEFAULT 1,
  `checksum`          VARCHAR(64)  NULL,
  `primera_impresion` TIMESTAMP    NULL,
  `veces_impresa`     INT          NOT NULL DEFAULT 1,
  `ultimo_usuario`    VARCHAR(150) NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_gcfg_envio` (`envio_id`, `activa`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Config de etiqueta impresa por envío
-- ============================================================
CREATE TABLE IF NOT EXISTS `etiquetas_config_impresa` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `envio_id` INT NOT NULL,
  `mostrar_logo` TINYINT(1) DEFAULT 1,
  `mostrar_eslogan` TINYINT(1) DEFAULT 1,
  `mostrar_telefono` TINYINT(1) DEFAULT 1,
  `mostrar_telefono_adicional` TINYINT(1) DEFAULT 1,
  `mostrar_email` TINYINT(1) DEFAULT 1,
  `mostrar_sitio_web` TINYINT(1) DEFAULT 1,
  `mostrar_rfc` TINYINT(1) DEFAULT 1,
  `mostrar_direccion_fiscal` TINYINT(1) DEFAULT 1,
  `mostrar_barcode` TINYINT(1) DEFAULT 1,
  `mostrar_qr` TINYINT(1) DEFAULT 1,
  `mostrar_ruta` TINYINT(1) DEFAULT 1,
  `mostrar_descripcion` TINYINT(1) DEFAULT 1,
  `mostrar_dest_nombre` TINYINT(1) DEFAULT 1,
  `mostrar_dest_direccion` TINYINT(1) DEFAULT 1,
  `mostrar_dest_referencia` TINYINT(1) DEFAULT 1,
  `mostrar_dest_contacto` TINYINT(1) DEFAULT 1,
  `mostrar_dest_telefono` TINYINT(1) DEFAULT 1,
  `mostrar_alias_ruta` TINYINT(1) DEFAULT 0,
  `mostrar_peso_total` TINYINT(1) DEFAULT 1,
  `mostrar_peso_item` TINYINT(1) DEFAULT 0,
  `activa`            TINYINT(1)   NOT NULL DEFAULT 1,
  `presentado_portal` TINYINT(1)   NOT NULL DEFAULT 1,
  `checksum`          VARCHAR(64)  NULL,
  `primera_impresion` TIMESTAMP    NULL,
  `veces_impresa`     INT          NOT NULL DEFAULT 1,
  `ultimo_usuario`    VARCHAR(150) NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ecfg_envio` (`envio_id`, `activa`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Historial de impresiones (guía y etiqueta)
-- ============================================================
CREATE TABLE IF NOT EXISTS `impresiones_log` (
  `id`             INT          NOT NULL AUTO_INCREMENT,
  `envio_id`       INT          NOT NULL,
  `tipo`           ENUM('guia','etiqueta') NOT NULL,
  `usuario_id`     INT          NULL,
  `usuario_nombre` VARCHAR(150) NOT NULL DEFAULT 'Sistema',
  `fecha`          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `tuvo_cambios`   TINYINT(1)   NOT NULL DEFAULT 0,
  `desde_portal`   TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_implog_envio` (`envio_id`, `tipo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- FKs diferidas (usuarios → clientes)
-- ============================================================
ALTER TABLE `usuarios`
  ADD CONSTRAINT `usuarios_ibfk_1`
    FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE SET NULL;


-- ------------------------------------------------------------
-- Tabla: actividad_log
-- Registro de todas las acciones realizadas en el sistema
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `actividad_log` (
  `id`             INT          NOT NULL AUTO_INCREMENT,
  `fecha`          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `usuario_id`     INT          NULL,
  `usuario_nombre` VARCHAR(150) NOT NULL DEFAULT 'Sistema',
  `usuario_rol`    VARCHAR(50)  NOT NULL DEFAULT 'sistema',
  `accion`         VARCHAR(60)  NOT NULL,
  `entidad`        VARCHAR(50)  NOT NULL,
  `entidad_id`     INT          NULL,
  `descripcion`    VARCHAR(500) NOT NULL,
  `detalle`        JSON         NULL,
  `ip`             VARCHAR(50)  NULL,
  PRIMARY KEY (`id`),
  KEY `idx_activ_fecha`   (`fecha`),
  KEY `idx_activ_usuario` (`usuario_id`),
  KEY `idx_activ_accion`  (`accion`),
  KEY `idx_activ_entidad` (`entidad`, `entidad_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Schema actualizado: 2026-04-15
