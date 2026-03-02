-- MySQL dump 10.13  Distrib 9.6.0, for Win64 (x86_64)
--
-- Host: localhost    Database: tracking_local
-- ------------------------------------------------------
-- Server version	9.6.0

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
SET @MYSQLDUMP_TEMP_LOG_BIN = @@SESSION.SQL_LOG_BIN;
SET @@SESSION.SQL_LOG_BIN= 0;

--
-- GTID state at the beginning of the backup 
--

SET @@GLOBAL.GTID_PURGED=/*!80000 '+'*/ '6a972c37-00a1-11f1-ad07-107c614edff1:1-208';

--
-- Table structure for table `clientes`
--

DROP TABLE IF EXISTS `clientes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clientes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre_empresa` varchar(150) NOT NULL,
  `contacto` varchar(100) DEFAULT NULL,
  `telefono` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `direccion` text,
  `fecha_creacion` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `activo` tinyint(1) DEFAULT '1',
  `prefijo_tracking` varchar(10) NOT NULL DEFAULT 'TRK',
  `ultimo_numero_tracking` int unsigned NOT NULL DEFAULT '0',
  `eliminado_en` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_prefijo_tracking` (`prefijo_tracking`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `configuracion_sistema`
--

DROP TABLE IF EXISTS `configuracion_sistema`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `configuracion_sistema` (
  `id` int NOT NULL AUTO_INCREMENT,
  `clave` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `valor` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `tipo` enum('texto','numero','boolean','json') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'texto',
  `categoria` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `descripcion` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `fecha_modificacion` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `modificado_por` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `clave` (`clave`),
  KEY `modificado_por` (`modificado_por`),
  CONSTRAINT `configuracion_sistema_ibfk_1` FOREIGN KEY (`modificado_por`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=141 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `direcciones_cliente`
--

DROP TABLE IF EXISTS `direcciones_cliente`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `direcciones_cliente` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cliente_id` int NOT NULL,
  `alias` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre descriptivo: Bodega Principal, Sucursal Centro, etc.',
  `tipo` enum('origen','destino','ambos') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ambos',
  `calle` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `colonia` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `ciudad` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `estado` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `cp` varchar(5) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `referencia` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `es_predeterminada` tinyint(1) DEFAULT '0' COMMENT 'Direcci├│n por defecto para este cliente',
  `activa` tinyint(1) DEFAULT '1',
  `fecha_creacion` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cliente_id` (`cliente_id`),
  KEY `idx_tipo` (`tipo`),
  KEY `idx_activa` (`activa`),
  CONSTRAINT `direcciones_cliente_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Direcciones frecuentes guardadas por cliente';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `direcciones_empresa`
--

DROP TABLE IF EXISTS `direcciones_empresa`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `direcciones_empresa` (
  `id` int NOT NULL AUTO_INCREMENT,
  `alias` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre descriptivo: Bodega Central, Almac├®n Norte, etc.',
  `calle` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `colonia` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `ciudad` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `estado` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `cp` varchar(5) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `referencia` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `es_predeterminada` tinyint(1) DEFAULT '0' COMMENT 'Direcci├│n predeterminada para nuevos env├¡os',
  `activa` tinyint(1) DEFAULT '1',
  `fecha_creacion` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_alias_unico` (`alias`),
  KEY `idx_activa` (`activa`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Direcciones de la empresa desde donde se originan env├¡os';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `envio_items`
--

DROP TABLE IF EXISTS `envio_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `envio_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `envio_id` int NOT NULL,
  `cantidad` int NOT NULL DEFAULT '1',
  `tipo` varchar(100) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `peso` decimal(10,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id`),
  KEY `envio_id` (`envio_id`),
  CONSTRAINT `envio_items_ibfk_1` FOREIGN KEY (`envio_id`) REFERENCES `envios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `envios`
--

DROP TABLE IF EXISTS `envios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `envios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `numero_tracking` varchar(50) NOT NULL,
  `referencia_cliente` varchar(100) DEFAULT NULL,
  `cliente_id` int DEFAULT NULL,
  `cliente_nombre` varchar(255) DEFAULT NULL,
  `origen` varchar(200) NOT NULL,
  `destino` varchar(200) NOT NULL,
  `origen_calle` varchar(255) DEFAULT NULL,
  `origen_colonia` varchar(100) DEFAULT NULL,
  `origen_ciudad` varchar(100) DEFAULT NULL,
  `origen_estado` varchar(50) DEFAULT NULL,
  `origen_cp` varchar(5) DEFAULT NULL,
  `origen_referencia` varchar(255) DEFAULT NULL,
  `destino_calle` varchar(255) DEFAULT NULL,
  `destino_colonia` varchar(100) DEFAULT NULL,
  `destino_ciudad` varchar(100) DEFAULT NULL,
  `destino_estado` varchar(50) DEFAULT NULL,
  `destino_cp` varchar(5) DEFAULT NULL,
  `destino_referencia` varchar(255) DEFAULT NULL,
  `descripcion` text,
  `peso` decimal(10,2) DEFAULT NULL,
  `estado_actual` varchar(50) DEFAULT 'creado',
  `fecha_creacion` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_estimada_entrega` date DEFAULT NULL,
  `usuario_creador_id` int DEFAULT NULL,
  `es_parcial` tinyint(1) NOT NULL DEFAULT '0',
  `envio_relacionado_id` int DEFAULT NULL,
  `es_complemento` tinyint(1) NOT NULL DEFAULT '0',
  `numero_parte` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `numero_tracking` (`numero_tracking`),
  KEY `cliente_id` (`cliente_id`),
  KEY `usuario_creador_id` (`usuario_creador_id`),
  KEY `idx_numero_tracking` (`numero_tracking`),
  KEY `fk_envio_relacionado` (`envio_relacionado_id`),
  CONSTRAINT `envios_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`),
  CONSTRAINT `envios_ibfk_2` FOREIGN KEY (`usuario_creador_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_envio_relacionado` FOREIGN KEY (`envio_relacionado_id`) REFERENCES `envios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `fotos_evidencia`
--

DROP TABLE IF EXISTS `fotos_evidencia`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fotos_evidencia` (
  `id` int NOT NULL AUTO_INCREMENT,
  `historial_estado_id` int NOT NULL,
  `url_foto` varchar(500) NOT NULL,
  `descripcion` text,
  `fecha_subida` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `historial_estado_id` (`historial_estado_id`),
  CONSTRAINT `fotos_evidencia_ibfk_1` FOREIGN KEY (`historial_estado_id`) REFERENCES `historial_estados` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `historial_estados`
--

DROP TABLE IF EXISTS `historial_estados`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `historial_estados` (
  `id` int NOT NULL AUTO_INCREMENT,
  `envio_id` int NOT NULL,
  `estado` varchar(50) NOT NULL,
  `ubicacion` varchar(200) DEFAULT NULL,
  `comentarios` text,
  `foto_evidencia` varchar(255) DEFAULT NULL,
  `fecha_hora` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `usuario_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `envio_id` (`envio_id`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `historial_estados_ibfk_1` FOREIGN KEY (`envio_id`) REFERENCES `envios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `historial_estados_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=82 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `usuarios`
--

DROP TABLE IF EXISTS `usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `rol` enum('admin','operador','cliente','superusuario') DEFAULT 'operador',
  `activo` tinyint(1) DEFAULT '1',
  `fecha_creacion` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `cliente_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `fk_usuario_cliente` (`cliente_id`),
  CONSTRAINT `usuarios_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
SET @@SESSION.SQL_LOG_BIN = @MYSQLDUMP_TEMP_LOG_BIN;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-01 18:04:28
