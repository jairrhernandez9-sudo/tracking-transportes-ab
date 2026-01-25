/**
 * ROLLBACK: Revertir prefijos personalizados por cliente
 * Fecha: 2025-01-24
 * Descripción: Revierte la migración de prefijos personalizados
 * 
 * USO:
 *   node scripts/migrations/rollback_prefijos_personalizados.js
 * 
 * ⚠️ ADVERTENCIA:
 *   Esto eliminará los campos agregados por la migración
 *   Solo ejecutar si necesitas deshacer los cambios
 */

const db = require('../../config/database');

async function ejecutarRollback() {
  console.log('🔄 Iniciando rollback: Prefijos personalizados...\n');
  
  try {
    // =====================================================
    // ADVERTENCIA
    // =====================================================
    console.log('⚠️  ADVERTENCIA:');
    console.log('   Este script eliminará los siguientes elementos:');
    console.log('   - Campo: clientes.prefijo_tracking');
    console.log('   - Campo: clientes.ultimo_numero_tracking');
    console.log('   - Índice: unique_prefijo_tracking');
    console.log('   - Índice: idx_numero_tracking\n');
    
    // =====================================================
    // PASO 1: Verificar que la tabla clientes existe
    // =====================================================
    console.log('📋 PASO 1: Verificando tabla clientes...');
    const [tables] = await db.query(`
      SHOW TABLES LIKE 'clientes'
    `);
    
    if (tables.length === 0) {
      console.error('❌ ERROR: La tabla clientes no existe.');
      process.exit(1);
    }
    
    console.log('✅ Tabla clientes encontrada\n');
    
    // =====================================================
    // PASO 2: Verificar si los campos existen
    // =====================================================
    console.log('📋 PASO 2: Verificando campos...');
    const [columns] = await db.query("SHOW COLUMNS FROM clientes");
    
    const tienePrefijo = columns.some(col => col.Field === 'prefijo_tracking');
    const tieneContador = columns.some(col => col.Field === 'ultimo_numero_tracking');
    
    if (!tienePrefijo && !tieneContador) {
      console.log('⚠️  Los campos no existen. No hay nada que revertir.\n');
      await db.end();
      process.exit(0);
    }
    
    console.log('✅ Campos encontrados, procediendo con rollback\n');
    
    // =====================================================
    // PASO 3: Eliminar índice único
    // =====================================================
    if (tienePrefijo) {
      console.log('📋 PASO 3: Eliminando índice único...');
      try {
        await db.query(`
          ALTER TABLE clientes 
          DROP INDEX unique_prefijo_tracking
        `);
        console.log('   ✅ unique_prefijo_tracking - Índice eliminado\n');
      } catch (error) {
        if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
          console.log('   ⚠️  Índice no existe, se omite\n');
        } else {
          throw error;
        }
      }
    }
    
    // =====================================================
    // PASO 4: Eliminar campo prefijo_tracking
    // =====================================================
    if (tienePrefijo) {
      console.log('📋 PASO 4: Eliminando campo prefijo_tracking...');
      await db.query(`
        ALTER TABLE clientes 
        DROP COLUMN prefijo_tracking
      `);
      console.log('   ✅ prefijo_tracking - Campo eliminado\n');
    }
    
    // =====================================================
    // PASO 5: Eliminar campo ultimo_numero_tracking
    // =====================================================
    if (tieneContador) {
      console.log('📋 PASO 5: Eliminando campo ultimo_numero_tracking...');
      await db.query(`
        ALTER TABLE clientes 
        DROP COLUMN ultimo_numero_tracking
      `);
      console.log('   ✅ ultimo_numero_tracking - Campo eliminado\n');
    }
    
    // =====================================================
    // PASO 6: Eliminar índice de envíos
    // =====================================================
    console.log('📋 PASO 6: Eliminando índice de búsqueda...');
    try {
      await db.query(`
        DROP INDEX idx_numero_tracking ON envios
      `);
      console.log('   ✅ idx_numero_tracking - Índice eliminado\n');
    } catch (error) {
      if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
        console.log('   ⚠️  Índice no existe, se omite\n');
      } else {
        throw error;
      }
    }
    
    // =====================================================
    // PASO 7: Revertir tamaño de numero_tracking (opcional)
    // =====================================================
    console.log('📋 PASO 7: Revirtiendo tamaño de numero_tracking...');
    await db.query(`
      ALTER TABLE envios 
      MODIFY COLUMN numero_tracking VARCHAR(20) NOT NULL
    `);
    console.log('   ✅ numero_tracking - Revertido a VARCHAR(20)\n');
    
    // =====================================================
    // VERIFICACIÓN
    // =====================================================
    console.log('📋 PASO 8: Verificando rollback...');
    const [finalColumns] = await db.query('DESCRIBE clientes');
    
    const tienePrefijo2 = finalColumns.some(col => col.Field === 'prefijo_tracking');
    const tieneContador2 = finalColumns.some(col => col.Field === 'ultimo_numero_tracking');
    
    if (tienePrefijo2 || tieneContador2) {
      throw new Error('Rollback fallido: campos todavía existen');
    }
    
    console.log('   ✅ Rollback verificado correctamente\n');
    
    // =====================================================
    // RESUMEN
    // =====================================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ ROLLBACK COMPLETADO\n');
    console.log('   📊 Elementos eliminados:');
    console.log('      ✅ clientes.prefijo_tracking');
    console.log('      ✅ clientes.ultimo_numero_tracking');
    console.log('      ✅ unique_prefijo_tracking');
    console.log('      ✅ idx_numero_tracking');
    console.log('\n   🔄 Elementos revertidos:');
    console.log('      ✅ envios.numero_tracking → VARCHAR(20)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('📝 La base de datos ha sido revertida al estado anterior.\n');
    
    console.log('ℹ️  Si necesitas volver a ejecutar la migración:');
    console.log('   node scripts/migrations/agregar_prefijos_personalizados.js\n');
    
    // Cerrar conexión
    await db.end();
    
    console.log('✅ ¡Rollback ejecutado exitosamente!\n');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ ERROR al ejecutar el rollback:');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(error.message);
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

// Ejecutar rollback
ejecutarRollback();
