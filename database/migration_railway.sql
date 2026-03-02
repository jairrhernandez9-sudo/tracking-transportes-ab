-- ================================================================
-- MIGRACIÓN: Sincronizar Railway (producción) con esquema local
-- Fecha: 2026-03-01
-- Ejecutar en: railway (base de datos de producción)
-- ================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ────────────────────────────────────────────────────────────────
-- 1. CREAR tabla `envio_items` (no existe en producción)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `envio_items` (
  `id`          int           NOT NULL AUTO_INCREMENT,
  `envio_id`    int           NOT NULL,
  `cantidad`    int           NOT NULL DEFAULT '1',
  `tipo`        varchar(100)  NOT NULL,
  `descripcion` varchar(255)  DEFAULT NULL,
  `peso`        decimal(10,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id`),
  KEY `envio_id` (`envio_id`),
  CONSTRAINT `envio_items_ibfk_1`
    FOREIGN KEY (`envio_id`) REFERENCES `envios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ────────────────────────────────────────────────────────────────
-- 2. AGREGAR columnas faltantes en `envios`
-- ────────────────────────────────────────────────────────────────
ALTER TABLE `envios`
  ADD COLUMN `es_parcial`           tinyint(1) NOT NULL DEFAULT '0' AFTER `usuario_creador_id`,
  ADD COLUMN `envio_relacionado_id` int        DEFAULT NULL          AFTER `es_parcial`,
  ADD COLUMN `es_complemento`       tinyint(1) NOT NULL DEFAULT '0' AFTER `envio_relacionado_id`,
  ADD COLUMN `numero_parte`         int        DEFAULT NULL          AFTER `es_complemento`;

-- Índice y FK self-referencial (envío parcial / complemento)
ALTER TABLE `envios`
  ADD INDEX `fk_envio_relacionado` (`envio_relacionado_id`);

ALTER TABLE `envios`
  ADD CONSTRAINT `fk_envio_relacionado`
    FOREIGN KEY (`envio_relacionado_id`) REFERENCES `envios` (`id`) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────────
-- 3. AGREGAR columna `cliente_id` en `usuarios` + FK
-- ────────────────────────────────────────────────────────────────
ALTER TABLE `usuarios`
  ADD COLUMN `cliente_id` int DEFAULT NULL AFTER `fecha_creacion`;

ALTER TABLE `usuarios`
  ADD INDEX `fk_usuario_cliente` (`cliente_id`);

ALTER TABLE `usuarios`
  ADD CONSTRAINT `usuarios_ibfk_1`
    FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────────
-- 4. MODIFICAR ENUM `rol` en `usuarios` (agregar 'superusuario')
-- ────────────────────────────────────────────────────────────────
ALTER TABLE `usuarios`
  MODIFY COLUMN `rol` enum('admin','operador','cliente','superusuario') DEFAULT 'operador';

SET FOREIGN_KEY_CHECKS = 1;
