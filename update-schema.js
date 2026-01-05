const db = require('./config/database');

async function updateSchema() {
  try {
    console.log('📸 Actualizando esquema para múltiples fotos...\n');

    // Crear tabla para múltiples fotos por estado
    const query = `
      CREATE TABLE IF NOT EXISTS fotos_evidencia (
        id INT PRIMARY KEY AUTO_INCREMENT,
        historial_estado_id INT NOT NULL,
        url_foto VARCHAR(500) NOT NULL,
        descripcion TEXT,
        fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (historial_estado_id) REFERENCES historial_estados(id) ON DELETE CASCADE
      )
    `;

    await db.query(query);
    console.log('✅ Tabla fotos_evidencia creada');

    // Insertar fotos de ejemplo para el envío entregado (TRK-2024-001)
    const [historial] = await db.query(
      'SELECT id, estado FROM historial_estados WHERE envio_id = (SELECT id FROM envios WHERE numero_tracking = ?) ORDER BY fecha_hora',
      ['TRK-2024-001']
    );

    if (historial.length > 0) {
      // Foto para "En Preparación"
      const enPreparacion = historial.find(h => h.estado === 'en_preparacion');
      if (enPreparacion) {
        await db.query(
          'INSERT IGNORE INTO fotos_evidencia (historial_estado_id, url_foto, descripcion) VALUES (?, ?, ?)',
          [enPreparacion.id, '/images/evidencias/paquete-preparacion.jpg', 'Paquete empacado y listo para despacho']
        );
      }

      // Foto para "Entregado"
      const entregado = historial.find(h => h.estado === 'entregado');
      if (entregado) {
        await db.query(
          'INSERT IGNORE INTO fotos_evidencia (historial_estado_id, url_foto, descripcion) VALUES (?, ?, ?)',
          [entregado.id, '/images/evidencias/paquete-entregado.jpg', 'Paquete entregado y firmado por receptor']
        );
        await db.query(
          'INSERT IGNORE INTO fotos_evidencia (historial_estado_id, url_foto, descripcion) VALUES (?, ?, ?)',
          [entregado.id, '/images/evidencias/firma-recepcion.jpg', 'Firma de recepción - Juan Pérez']
        );
      }
    }

    console.log('✅ Fotos de ejemplo insertadas');
    console.log('\n🎉 Esquema actualizado correctamente\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateSchema();