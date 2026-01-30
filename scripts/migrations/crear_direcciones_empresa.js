/**
 * MIGRACIÓN: Crear tabla direcciones_empresa
 * Fecha: 2025-01-25
 * Descripción: Crea tabla para guardar direcciones de la empresa (orígenes de envíos)
 * 
 * USO:
 *   node scripts/migrations/crear_direcciones_empresa.js
 * 
 * PROPÓSITO:
 *   - Guardar ubicaciones desde donde la empresa ENVÍA
 *   - Ejemplos: Bodegas, Almacenes, Centros de Distribución
 *   - Se gestionan desde: Configuración > Empresa
 */

const db = require('../../config/database');

async function ejecutarMigracion() {
  console.log('🚀 Iniciando migración: Tabla direcciones_empresa...\n');
  
  try {
    // =====================================================
    // PASO 1: Verificar si la tabla ya existe
    // =====================================================
    console.log('📋 PASO 1: Verificando si la tabla ya existe...');
    const [existing] = await db.query(`
      SHOW TABLES LIKE 'direcciones_empresa'
    `);
    
    if (existing.length > 0) {
      console.log('⚠️  La tabla direcciones_empresa ya existe.');
      console.log('   Si quieres recrearla, usa el rollback primero.\n');
      await db.end();
      process.exit(0);
    }
    
    console.log('✅ La tabla no existe, procediendo con la creación\n');
    
    // =====================================================
    // PASO 2: Crear tabla direcciones_empresa
    // =====================================================
    console.log('📋 PASO 2: Creando tabla direcciones_empresa...');
    
    await db.query(`
      CREATE TABLE direcciones_empresa (
        id INT AUTO_INCREMENT PRIMARY KEY,
        alias VARCHAR(100) NOT NULL COMMENT 'Nombre descriptivo: Bodega Central, Almacén Norte, etc.',
        calle VARCHAR(255) NOT NULL,
        colonia VARCHAR(100) NOT NULL,
        ciudad VARCHAR(100) NOT NULL,
        estado VARCHAR(50) NOT NULL,
        cp VARCHAR(5) NOT NULL,
        referencia VARCHAR(255) NULL,
        es_predeterminada BOOLEAN DEFAULT FALSE COMMENT 'Dirección predeterminada para nuevos envíos',
        activa BOOLEAN DEFAULT TRUE,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_activa (activa),
        UNIQUE INDEX idx_alias_unico (alias)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='Direcciones de la empresa desde donde se originan envíos'
    `);
    
    console.log('   ✅ Tabla direcciones_empresa creada exitosamente\n');
    
    // =====================================================
    // PASO 3: Insertar dirección ejemplo (opcional)
    // =====================================================
    console.log('📋 PASO 3: ¿Insertar dirección ejemplo?');
    console.log('   ℹ️  Puedes agregar direcciones desde Configuración > Empresa\n');
    
    // =====================================================
    // PASO 4: Verificar estructura
    // =====================================================
    console.log('📋 PASO 4: Verificando estructura...');
    const [columns] = await db.query('DESCRIBE direcciones_empresa');
    
    console.log('   ✅ Campos creados:');
    columns.forEach(col => {
      console.log(`      - ${col.Field} (${col.Type})`);
    });
    console.log('');
    
    // =====================================================
    // RESUMEN
    // =====================================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ MIGRACIÓN COMPLETADA\n');
    console.log('   📊 Tabla creada: direcciones_empresa');
    console.log('\n   📋 Estructura:');
    console.log('      • id - ID único de la dirección');
    console.log('      • alias - Nombre descriptivo (ej: Bodega Central)');
    console.log('      • calle, colonia, ciudad, estado, cp');
    console.log('      • referencia - Detalles adicionales');
    console.log('      • es_predeterminada - Dirección por defecto');
    console.log('      • activa - Si está activa o no');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('📝 EJEMPLOS DE DIRECCIONES DE EMPRESA:\n');
    console.log('   Transportes AB');
    console.log('   ┌───────────────────────────────────────────┐');
    console.log('   │ 🏢 Bodega Central ⭐                     │');
    console.log('   │    Av. Constitución 123                  │');
    console.log('   │    Centro, Monterrey, NL 64000           │');
    console.log('   │    Ref: Andén 5, Portón azul             │');
    console.log('   └───────────────────────────────────────────┘');
    console.log('   ┌───────────────────────────────────────────┐');
    console.log('   │ 🏭 Centro de Distribución               │');
    console.log('   │    Carr. Nacional Km 5                   │');
    console.log('   │    Parque Industrial, Apodaca, NL        │');
    console.log('   │    Ref: Nave 3                           │');
    console.log('   └───────────────────────────────────────────┘');
    console.log('   ┌───────────────────────────────────────────┐');
    console.log('   │ 📦 Almacén Norte                        │');
    console.log('   │    Blvd. Venustiano Carranza 789         │');
    console.log('   │    Industrial, Saltillo, Coah            │');
    console.log('   │    Ref: Muelle B                         │');
    console.log('   └───────────────────────────────────────────┘\n');
    
    console.log('💡 USO EN EL SISTEMA:');
    console.log('   1. Ir a: Configuración > Empresa');
    console.log('   2. Sección: "Direcciones de Origen"');
    console.log('   3. Agregar direcciones de tu empresa');
    console.log('   4. Al crear envío:');
    console.log('      → Seleccionar origen del dropdown');
    console.log('      → Seleccionar destino (del cliente)');
    console.log('      → ¡Listo en segundos!\n');
    
    console.log('🎯 VENTAJAS:');
    console.log('   ✅ Direcciones de empresa centralizadas');
    console.log('   ✅ Se gestionan en un solo lugar (Configuración)');
    console.log('   ✅ Todos los usuarios usan las mismas direcciones');
    console.log('   ✅ Consistencia en todos los envíos');
    console.log('   ✅ Cambios se reflejan en todo el sistema\n');
    
    console.log('🚀 PRÓXIMOS PASOS:');
    console.log('   1. Modificar: routes/configuracion.js (CRUD direcciones empresa)');
    console.log('   2. Modificar: views/configuracion/index.ejs (sección direcciones)');
    console.log('   3. Crear: tabla direcciones_cliente (para destinos)');
    console.log('   4. Modificar: views/envios/nuevo.ejs (usar dropdowns)');
    console.log('   5. Reiniciar servidor\n');
    
    console.log('📊 DIFERENCIA:');
    console.log('   direcciones_empresa → ORÍGENES (tu empresa)');
    console.log('   direcciones_cliente → DESTINOS (tus clientes)\n');
    
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