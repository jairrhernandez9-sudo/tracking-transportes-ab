const db = require('../config/database');

async function crearTablaConfiguracion() {
  try {
    console.log('🔄 Creando tabla configuracion_sistema...');
    
    // Crear tabla
    await db.query(`
      CREATE TABLE IF NOT EXISTS configuracion_sistema (
        id INT PRIMARY KEY AUTO_INCREMENT,
        clave VARCHAR(100) UNIQUE NOT NULL,
        valor TEXT,
        tipo ENUM('texto', 'numero', 'boolean', 'json') DEFAULT 'texto',
        categoria VARCHAR(50),
        descripcion TEXT,
        fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        modificado_por INT,
        FOREIGN KEY (modificado_por) REFERENCES usuarios(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('✅ Tabla creada correctamente');
    
    console.log('🔄 Insertando configuraciones por defecto...');
    
    // Insertar datos iniciales
    await db.query(`
      INSERT INTO configuracion_sistema (clave, valor, tipo, categoria, descripcion) VALUES
      ('empresa_nombre', 'Transportes AB', 'texto', 'empresa', 'Nombre de la empresa'),
      ('empresa_rfc', '', 'texto', 'empresa', 'RFC de la empresa'),
      ('empresa_telefono', '', 'texto', 'empresa', 'Teléfono de contacto'),
      ('empresa_email', 'contacto@transportesab.com', 'texto', 'empresa', 'Email de contacto'),
      ('empresa_direccion', '', 'texto', 'empresa', 'Dirección fiscal'),
      ('empresa_sitio_web', '', 'texto', 'empresa', 'Sitio web'),

      ('tarifa_base', '100', 'numero', 'tarifas', 'Tarifa base por envío'),
      ('tarifa_por_km', '5', 'numero', 'tarifas', 'Costo por kilómetro'),
      ('tarifa_seguro', '50', 'numero', 'tarifas', 'Costo de seguro'),
      ('iva_porcentaje', '16', 'numero', 'tarifas', 'Porcentaje de IVA'),

      ('notif_email_activo', 'true', 'boolean', 'notificaciones', 'Activar notificaciones por email'),
      ('notif_sms_activo', 'false', 'boolean', 'notificaciones', 'Activar notificaciones por SMS'),
      ('notif_envio_creado', 'true', 'boolean', 'notificaciones', 'Notificar cuando se crea un envío'),
      ('notif_envio_entregado', 'true', 'boolean', 'notificaciones', 'Notificar cuando se entrega'),
      ('notif_envio_retrasado', 'true', 'boolean', 'notificaciones', 'Notificar envíos retrasados'),

      ('dias_alerta_retraso', '5', 'numero', 'alertas', 'Días para alertar retraso'),
      ('auto_cancelar_dias', '30', 'numero', 'alertas', 'Días para auto-cancelar envíos'),

      ('tracking_publico_activo', 'true', 'boolean', 'tracking', 'Permitir tracking público'),
      ('mostrar_fotos_tracking', 'true', 'boolean', 'tracking', 'Mostrar fotos en tracking público')
      ON DUPLICATE KEY UPDATE valor=valor
    `);
    
    console.log('✅ Configuraciones insertadas correctamente');
    console.log('');
    console.log('🎉 ¡Todo listo! Tabla configuracion_sistema creada con éxito');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al crear la tabla:', error);
    process.exit(1);
  }
}

crearTablaConfiguracion();