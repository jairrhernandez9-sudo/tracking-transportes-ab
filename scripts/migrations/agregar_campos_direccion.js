/**
 * MIGRACIÓN: Agregar campos de dirección detallada
 * Fecha: 2025-01-25
 * Descripción: Agrega campos para almacenar direcciones completas de origen y destino
 * 
 * USO:
 *   node scripts/migrations/agregar_campos_direccion.js
 * 
 * CAMBIOS:
 *   - Agrega 6 campos para dirección de origen
 *   - Agrega 6 campos para dirección de destino
 *   - Mantiene campos origen y destino actuales para compatibilidad
 */

const db = require('../../config/database');

async function ejecutarMigracion() {
  console.log('🚀 Iniciando migración: Campos de dirección detallada...\n');
  
  try {
    // =====================================================
    // PASO 1: Verificar que la tabla envios existe
    // =====================================================
    console.log('📋 PASO 1: Verificando tabla envios...');
    const [tables] = await db.query(`
      SHOW TABLES LIKE 'envios'
    `);
    
    if (tables.length === 0) {
      console.error('❌ ERROR: La tabla envios no existe.');
      console.log('   Asegúrate de haber creado la tabla primero.');
      process.exit(1);
    }
    
    console.log('✅ Tabla envios encontrada\n');
    
    // =====================================================
    // PASO 2: Verificar si los campos ya existen
    // =====================================================
    console.log('📋 PASO 2: Verificando si los campos ya existen...');
    const [columns] = await db.query(
      "SHOW COLUMNS FROM envios LIKE 'origen_calle'"
    );
    
    if (columns.length > 0) {
      console.log('⚠️  Los campos ya existen. Migración ya ejecutada anteriormente.');
      console.log('   Si quieres volver a ejecutarla, usa el rollback primero.\n');
      await db.end();
      process.exit(0);
    }
    
    console.log('✅ Los campos no existen, procediendo con la migración\n');
    
    // =====================================================
    // PASO 3: Agregar campos de ORIGEN
    // =====================================================
    console.log('📋 PASO 3: Agregando campos de dirección de ORIGEN...');
    
    await db.query(`
      ALTER TABLE envios 
      ADD COLUMN origen_calle VARCHAR(255) NULL AFTER destino,
      ADD COLUMN origen_colonia VARCHAR(100) NULL AFTER origen_calle,
      ADD COLUMN origen_ciudad VARCHAR(100) NULL AFTER origen_colonia,
      ADD COLUMN origen_estado VARCHAR(50) NULL AFTER origen_ciudad,
      ADD COLUMN origen_cp VARCHAR(5) NULL AFTER origen_estado,
      ADD COLUMN origen_referencia VARCHAR(255) NULL AFTER origen_cp
    `);
    
    console.log('   ✅ origen_calle - Campo agregado');
    console.log('   ✅ origen_colonia - Campo agregado');
    console.log('   ✅ origen_ciudad - Campo agregado');
    console.log('   ✅ origen_estado - Campo agregado');
    console.log('   ✅ origen_cp - Campo agregado');
    console.log('   ✅ origen_referencia - Campo agregado\n');
    
    // =====================================================
    // PASO 4: Agregar campos de DESTINO
    // =====================================================
    console.log('📋 PASO 4: Agregando campos de dirección de DESTINO...');
    
    await db.query(`
      ALTER TABLE envios 
      ADD COLUMN destino_calle VARCHAR(255) NULL AFTER origen_referencia,
      ADD COLUMN destino_colonia VARCHAR(100) NULL AFTER destino_calle,
      ADD COLUMN destino_ciudad VARCHAR(100) NULL AFTER destino_colonia,
      ADD COLUMN destino_estado VARCHAR(50) NULL AFTER destino_ciudad,
      ADD COLUMN destino_cp VARCHAR(5) NULL AFTER destino_estado,
      ADD COLUMN destino_referencia VARCHAR(255) NULL AFTER destino_cp
    `);
    
    console.log('   ✅ destino_calle - Campo agregado');
    console.log('   ✅ destino_colonia - Campo agregado');
    console.log('   ✅ destino_ciudad - Campo agregado');
    console.log('   ✅ destino_estado - Campo agregado');
    console.log('   ✅ destino_cp - Campo agregado');
    console.log('   ✅ destino_referencia - Campo agregado\n');
    
    // =====================================================
    // PASO 5: Verificación final
    // =====================================================
    console.log('📋 PASO 5: Verificando migración...');
    const [finalColumns] = await db.query('DESCRIBE envios');
    
    const camposOrigen = [
      'origen_calle', 'origen_colonia', 'origen_ciudad', 
      'origen_estado', 'origen_cp', 'origen_referencia'
    ];
    
    const camposDestino = [
      'destino_calle', 'destino_colonia', 'destino_ciudad',
      'destino_estado', 'destino_cp', 'destino_referencia'
    ];
    
    const todosCampos = [...camposOrigen, ...camposDestino];
    const camposCreados = finalColumns.filter(col => 
      todosCampos.includes(col.Field)
    );
    
    if (camposCreados.length !== 12) {
      throw new Error(`Verificación fallida: se esperaban 12 campos, se encontraron ${camposCreados.length}`);
    }
    
    console.log('   ✅ Todos los campos verificados correctamente\n');
    
    // =====================================================
    // PASO 6: Verificar envíos existentes
    // =====================================================
console.log('📋 PASO 6: Verificando envíos existentes...');
    const [envios] = await db.query('SELECT COUNT(*) as total FROM envios');
    const totalEnvios = envios[0].total;
    
    if (totalEnvios > 0) {
      console.log(`   📊 Encontrados ${totalEnvios} envíos existentes`);
      console.log('   ℹ️  Los envíos existentes mantienen sus direcciones en los campos origen y destino');
      console.log('   ℹ️  Los nuevos envíos usarán los campos detallados\n');
    } else {
      console.log('   ℹ️  No hay envíos existentes\n');
    }
    
    // =====================================================
    // RESUMEN
    // =====================================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ MIGRACIÓN COMPLETADA\n');
    console.log('   📊 Campos agregados para ORIGEN:');
    console.log('      ✅ origen_calle (VARCHAR 255)');
    console.log('      ✅ origen_colonia (VARCHAR 100)');
    console.log('      ✅ origen_ciudad (VARCHAR 100)');
    console.log('      ✅ origen_estado (VARCHAR 50)');
    console.log('      ✅ origen_cp (VARCHAR 5)');
    console.log('      ✅ origen_referencia (VARCHAR 255)');
    console.log('\n   📊 Campos agregados para DESTINO:');
    console.log('      ✅ destino_calle (VARCHAR 255)');
    console.log('      ✅ destino_colonia (VARCHAR 100)');
    console.log('      ✅ destino_ciudad (VARCHAR 100)');
    console.log('      ✅ destino_estado (VARCHAR 50)');
    console.log('      ✅ destino_cp (VARCHAR 5)');
    console.log('      ✅ destino_referencia (VARCHAR 255)');
    console.log('\n   ℹ️  Campos antiguos conservados:');
    console.log('      ✅ origen (VARCHAR 255) - Se llena automáticamente');
    console.log('      ✅ destino (VARCHAR 255) - Se llena automáticamente');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('📝 EJEMPLO DE DIRECCIÓN COMPLETA:\n');
    console.log('   ORIGEN:');
    console.log('   ├─ Calle: Av. Constitución 123');
    console.log('   ├─ Colonia: Centro');
    console.log('   ├─ Ciudad: Monterrey');
    console.log('   ├─ Estado: Nuevo León');
    console.log('   ├─ CP: 64000');
    console.log('   └─ Referencia: Sucursal 30\n');
    
    console.log('   Campo "origen" automático:');
    console.log('   → "Av. Constitución 123, Centro, Monterrey, Nuevo León, 64000"\n');
    
    console.log('🚀 PRÓXIMOS PASOS:');
    console.log('   1. Modificar: routes/envios.js (procesar nuevos campos)');
    console.log('   2. Modificar: views/envios/detalle.ejs (mostrar dirección completa)');
    console.log('   3. Reiniciar servidor\n');
    
    // Cerrar conexión
    await db.end();
    
    console.log('🎉 ¡Migración ejecutada exitosamente!\n');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ ERROR al ejecutar la migración:');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(error.message);
    
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('\n💡 Sugerencia: El campo ya existe.');
      console.log('   Es posible que la migración ya se haya ejecutado.');
      console.log('   Ejecuta el rollback si necesitas volver a ejecutarla.\n');
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