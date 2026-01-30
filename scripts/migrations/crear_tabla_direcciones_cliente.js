/**
 * MIGRACIÓN: Crear tabla direcciones_cliente
 * Fecha: 2025-01-25
 * Descripción: Crea tabla para almacenar direcciones frecuentes por cliente
 * 
 * USO:
 *   node scripts/migrations/crear_tabla_direcciones_cliente.js
 * 
 * CAMBIOS:
 *   - Crea tabla direcciones_cliente
 *   - Almacena múltiples direcciones por cliente
 *   - Permite direcciones de origen, destino o ambos
 */

const db = require('../../config/database');

async function ejecutarMigracion() {
  console.log('🚀 Iniciando migración: Tabla direcciones_cliente...\n');
  
  try {
    // =====================================================
    // PASO 1: Verificar que la tabla clientes existe
    // =====================================================
    console.log('📋 PASO 1: Verificando tabla clientes...');
    const [tables] = await db.query(`
      SHOW TABLES LIKE 'clientes'
    `);
    
    if (tables.length === 0) {
      console.error('❌ ERROR: La tabla clientes no existe.');
      console.log('   Asegúrate de haber creado la tabla clientes primero.');
      process.exit(1);
    }
    
    console.log('✅ Tabla clientes encontrada\n');
    
    // =====================================================
    // PASO 2: Verificar si la tabla ya existe
    // =====================================================
    console.log('📋 PASO 2: Verificando si la tabla ya existe...');
    const [existing] = await db.query(`
      SHOW TABLES LIKE 'direcciones_cliente'
    `);
    
    if (existing.length > 0) {
      console.log('⚠️  La tabla direcciones_cliente ya existe.');
      console.log('   Si quieres recrearla, usa el rollback primero.\n');
      await db.end();
      process.exit(0);
    }
    
    console.log('✅ La tabla no existe, procediendo con la creación\n');
    
    // =====================================================
    // PASO 3: Crear tabla direcciones_cliente
    // =====================================================
    console.log('📋 PASO 3: Creando tabla direcciones_cliente...');
    
    await db.query(`
      CREATE TABLE direcciones_cliente (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cliente_id INT NOT NULL,
        alias VARCHAR(100) NOT NULL COMMENT 'Nombre descriptivo: Bodega Principal, Sucursal Centro, etc.',
        tipo ENUM('origen', 'destino', 'ambos') NOT NULL DEFAULT 'ambos',
        calle VARCHAR(255) NOT NULL,
        colonia VARCHAR(100) NOT NULL,
        ciudad VARCHAR(100) NOT NULL,
        estado VARCHAR(50) NOT NULL,
        cp VARCHAR(5) NOT NULL,
        referencia VARCHAR(255) NULL,
        es_predeterminada BOOLEAN DEFAULT FALSE COMMENT 'Dirección por defecto para este cliente',
        activa BOOLEAN DEFAULT TRUE,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
        INDEX idx_cliente_id (cliente_id),
        INDEX idx_tipo (tipo),
        INDEX idx_activa (activa)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='Direcciones frecuentes guardadas por cliente'
    `);
    
    console.log('   ✅ Tabla direcciones_cliente creada exitosamente\n');
    
    // =====================================================
    // PASO 4: Mostrar estructura de la tabla
    // =====================================================
    console.log('📋 PASO 4: Verificando estructura...');
    const [columns] = await db.query('DESCRIBE direcciones_cliente');
    
    console.log('   ✅ Campos creados:');
    columns.forEach(col => {
      console.log(`      - ${col.Field} (${col.Type})`);
    });
    console.log('');
    
    // =====================================================
    // PASO 5: Verificar clientes existentes
    // =====================================================
    console.log('📋 PASO 5: Verificando clientes...');
    const [clientes] = await db.query('SELECT COUNT(*) as total FROM clientes');
    const totalClientes = clientes[0].total;
    
    if (totalClientes > 0) {
      console.log(`   📊 Encontrados ${totalClientes} clientes`);
      console.log('   ℹ️  Puedes empezar a agregar direcciones para cada cliente\n');
    } else {
      console.log('   ℹ️  No hay clientes registrados aún\n');
    }
    
    // =====================================================
    // RESUMEN
    // =====================================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ MIGRACIÓN COMPLETADA\n');
    console.log('   📊 Tabla creada: direcciones_cliente');
    console.log('\n   📋 Estructura:');
    console.log('      • id - ID único de la dirección');
    console.log('      • cliente_id - Cliente al que pertenece');
    console.log('      • alias - Nombre descriptivo (ej: Bodega Principal)');
    console.log('      • tipo - origen, destino o ambos');
    console.log('      • calle, colonia, ciudad, estado, cp');
    console.log('      • referencia - Detalles adicionales');
    console.log('      • es_predeterminada - Dirección por defecto');
    console.log('      • activa - Si está activa o no');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('📝 EJEMPLOS DE DIRECCIONES:\n');
    console.log('   Cliente: IT Piezas S.A.');
    console.log('   ┌───────────────────────────────────────────┐');
    console.log('   │ 🏢 Bodega Principal (Origen)             │');
    console.log('   │    Av. Constitución 123                  │');
    console.log('   │    Centro, Monterrey, NL 64000           │');
    console.log('   │    Ref: Entrada por portón azul          │');
    console.log('   └───────────────────────────────────────────┘');
    console.log('   ┌───────────────────────────────────────────┐');
    console.log('   │ 🏪 Sucursal Centro (Destino)             │');
    console.log('   │    Calle Morelos 456                     │');
    console.log('   │    San Jerónimo, CDMX 01000              │');
    console.log('   │    Ref: Piso 3, Oficina 305              │');
    console.log('   └───────────────────────────────────────────┘\n');
    
    console.log('💡 VENTAJAS:');
    console.log('   ✅ Cliente guarda sus direcciones frecuentes');
    console.log('   ✅ Al crear envío, solo selecciona de la lista');
    console.log('   ✅ Ahorra tiempo (30 seg vs 3 min)');
    console.log('   ✅ Reduce errores de captura');
    console.log('   ✅ Direcciones siempre consistentes\n');
    
    console.log('🚀 PRÓXIMOS PASOS:');
    console.log('   1. Crear: routes/direcciones.js (CRUD de direcciones)');
    console.log('   2. Agregar: Sección de direcciones en detalle de cliente');
    console.log('   3. Modificar: Formulario de crear envío (usar direcciones guardadas)');
    console.log('   4. Crear: Vista para gestionar direcciones');
    console.log('   5. Reiniciar servidor\n');
    
    console.log('📋 TIPOS DE DIRECCIÓN:');
    console.log('   • origen - Solo para envíos que salen de aquí');
    console.log('   • destino - Solo para envíos que llegan aquí');
    console.log('   • ambos - Puede ser origen o destino\n');
    
    // Cerrar conexión
    await db.end();
    
    console.log('🎉 ¡Migración ejecutada exitosamente!\n');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ ERROR al ejecutar la migración:');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(error.message);
    
    if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('\n💡 Sugerencia: La tabla ya existe.');
      console.log('   Ejecuta el rollback si necesitas recrearla.\n');
    }
    
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Cerrar conexión
    try {
      await db.end();
    } catch (e) {
      // Ignorar error al cerrar
    }
    
    process.exit(1);
  }
}

// Ejecutar migración
ejecutarMigracion();