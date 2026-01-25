/**
 * MIGRACIÓN: Agregar prefijos personalizados por cliente
 * Fecha: 2025-01-24
 * Descripción: Agrega campos para sistema de tracking personalizado
 * 
 * USO:
 *   node scripts/migrations/agregar_prefijos_personalizados.js
 * 
 * CAMBIOS:
 *   - Agrega campo prefijo_tracking a tabla clientes
 *   - Agrega campo ultimo_numero_tracking a tabla clientes
 *   - Modifica campo numero_tracking en tabla envios
 *   - Agrega índices para optimización
 */

const db = require('../../config/database');

/**
 * Genera un prefijo único basado en nombre de empresa
 */
function generarPrefijo(nombreEmpresa, numero) {
  if (!nombreEmpresa || nombreEmpresa.trim() === '') {
    return `CLI${numero}`;
  }

  // Eliminar caracteres especiales y tomar primeras letras
  const limpio = nombreEmpresa.replace(/[^A-Za-z\s]/g, '').trim();
  const palabras = limpio.split(/\s+/).filter(p => p.length > 0);
  
  let prefijo = '';
  
  if (palabras.length >= 3) {
    prefijo = palabras.slice(0, 3).map(p => p.charAt(0)).join('').toUpperCase();
  } else if (palabras.length > 0) {
    prefijo = palabras.join('').substring(0, 3).toUpperCase();
  } else {
    prefijo = 'CLI';
  }
  
  // Agregar número si es necesario para evitar duplicados
  return numero > 0 ? `${prefijo}${numero}` : prefijo;
}

async function ejecutarMigracion() {
  console.log('🚀 Iniciando migración: Prefijos personalizados por cliente...\n');
  
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
      console.log('   Asegúrate de haber creado la tabla primero.');
      process.exit(1);
    }
    
    console.log('✅ Tabla clientes encontrada\n');
    
    // =====================================================
    // PASO 2: Verificar si los campos ya existen
    // =====================================================
    console.log('📋 PASO 2: Verificando si los campos ya existen...');
    const [columns] = await db.query(
      "SHOW COLUMNS FROM clientes LIKE 'prefijo_tracking'"
    );
    
    if (columns.length > 0) {
      console.log('⚠️  Los campos ya existen. Migración ya ejecutada anteriormente.');
      console.log('   Si quieres volver a ejecutarla, usa el rollback primero.\n');
      await db.end();
      process.exit(0);
    }
    
    console.log('✅ Los campos no existen, procediendo con la migración\n');
    
    // =====================================================
    // PASO 3: Contar clientes existentes
    // =====================================================
    console.log('📋 PASO 3: Verificando clientes existentes...');
    const [clientes] = await db.query('SELECT COUNT(*) as total FROM clientes');
    const totalClientes = clientes[0].total;
    
    console.log(`   📊 Encontrados ${totalClientes} clientes existentes\n`);
    
    // =====================================================
    // PASO 4: Agregar campo prefijo_tracking SIN DEFAULT
    // =====================================================
    console.log('📋 PASO 4: Agregando campo prefijo_tracking...');
    await db.query(`
      ALTER TABLE clientes 
      ADD COLUMN prefijo_tracking VARCHAR(10) NULL
    `);
    console.log('   ✅ prefijo_tracking - Campo agregado correctamente\n');
    
    // =====================================================
    // PASO 5: Agregar campo ultimo_numero_tracking
    // =====================================================
    console.log('📋 PASO 5: Agregando campo ultimo_numero_tracking...');
    await db.query(`
      ALTER TABLE clientes 
      ADD COLUMN ultimo_numero_tracking INT UNSIGNED NOT NULL DEFAULT 0
    `);
    console.log('   ✅ ultimo_numero_tracking - Campo agregado correctamente\n');
    
    // =====================================================
    // PASO 6: Generar prefijos únicos para clientes existentes
    // =====================================================
    if (totalClientes > 0) {
      console.log('📋 PASO 6: Generando prefijos únicos para clientes existentes...');
      
      // Obtener todos los clientes
      const [clientesData] = await db.query(`
        SELECT id, nombre_empresa 
        FROM clientes 
        ORDER BY id ASC
      `);
      
      const prefijosUsados = new Set();
      let actualizados = 0;
      
      for (const cliente of clientesData) {
        let prefijo = '';
        let intento = 0;
        
        // Generar prefijo único
        do {
          prefijo = generarPrefijo(cliente.nombre_empresa, intento);
          intento++;
        } while (prefijosUsados.has(prefijo));
        
        prefijosUsados.add(prefijo);
        
        // Actualizar cliente
        await db.query(
          'UPDATE clientes SET prefijo_tracking = ? WHERE id = ?',
          [prefijo, cliente.id]
        );
        
        console.log(`   ✅ Cliente ID ${cliente.id}: ${cliente.nombre_empresa.substring(0, 30)} → ${prefijo}`);
        actualizados++;
      }
      
      console.log(`\n   📊 Total clientes actualizados: ${actualizados}\n`);
    } else {
      console.log('📋 PASO 6: No hay clientes existentes, se omite generación de prefijos\n');
    }
    
    // =====================================================
    // PASO 7: Establecer DEFAULT y NOT NULL
    // =====================================================
    console.log('📋 PASO 7: Configurando campo como NOT NULL con DEFAULT...');
    await db.query(`
      ALTER TABLE clientes 
      MODIFY COLUMN prefijo_tracking VARCHAR(10) NOT NULL DEFAULT 'TRK'
    `);
    console.log('   ✅ prefijo_tracking - Configurado como NOT NULL\n');
    
    // =====================================================
    // PASO 8: Agregar índice único
    // =====================================================
    console.log('📋 PASO 8: Agregando índice único...');
    await db.query(`
      ALTER TABLE clientes 
      ADD UNIQUE KEY unique_prefijo_tracking (prefijo_tracking)
    `);
    console.log('   ✅ unique_prefijo_tracking - Índice agregado correctamente\n');
    
    // =====================================================
    // PASO 9: Modificar campo numero_tracking en envios
    // =====================================================
    console.log('📋 PASO 9: Modificando campo numero_tracking en tabla envios...');
    await db.query(`
      ALTER TABLE envios 
      MODIFY COLUMN numero_tracking VARCHAR(50) NOT NULL
    `);
    console.log('   ✅ numero_tracking - Campo expandido a VARCHAR(50)\n');
    
    // =====================================================
    // PASO 10: Agregar índice para búsquedas rápidas
    // =====================================================
    console.log('📋 PASO 10: Agregando índice para búsquedas...');
    
    // Verificar si el índice ya existe
    const [indexes] = await db.query(`
      SHOW INDEX FROM envios WHERE Key_name = 'idx_numero_tracking'
    `);
    
    if (indexes.length === 0) {
      await db.query(`
        CREATE INDEX idx_numero_tracking ON envios(numero_tracking)
      `);
      console.log('   ✅ idx_numero_tracking - Índice agregado correctamente\n');
    } else {
      console.log('   ⚠️  idx_numero_tracking - Ya existe, se omite\n');
    }
    
    // =====================================================
    // PASO 11: Verificación final
    // =====================================================
    console.log('📋 PASO 11: Verificando migración...');
    const [finalColumns] = await db.query('DESCRIBE clientes');
    
    const tienePrefijo = finalColumns.some(col => col.Field === 'prefijo_tracking');
    const tieneContador = finalColumns.some(col => col.Field === 'ultimo_numero_tracking');
    
    if (!tienePrefijo || !tieneContador) {
      throw new Error('Verificación fallida: campos no encontrados');
    }
    
    console.log('   ✅ Todos los campos verificados correctamente\n');
    
    // =====================================================
    // PASO 12: Mostrar prefijos asignados
    // =====================================================
    console.log('📋 PASO 12: Prefijos asignados:');
    const [prefijosFinales] = await db.query(`
      SELECT id, nombre_empresa, prefijo_tracking 
      FROM clientes 
      ORDER BY id ASC 
      LIMIT 10
    `);
    
    if (prefijosFinales.length > 0) {
      console.log('');
      prefijosFinales.forEach(c => {
        console.log(`   🏷️  ${c.nombre_empresa.substring(0, 35).padEnd(35)} → ${c.prefijo_tracking}`);
      });
      
      if (totalClientes > 10) {
        console.log(`   ... y ${totalClientes - 10} más`);
      }
      console.log('');
    }
    
    // =====================================================
    // RESUMEN
    // =====================================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ MIGRACIÓN COMPLETADA\n');
    console.log('   📊 Campos agregados:');
    console.log('      ✅ clientes.prefijo_tracking (VARCHAR 10)');
    console.log('      ✅ clientes.ultimo_numero_tracking (INT)');
    console.log('      ✅ envios.numero_tracking (VARCHAR 50)');
    console.log('\n   🔍 Índices creados:');
    console.log('      ✅ unique_prefijo_tracking');
    console.log('      ✅ idx_numero_tracking');
    console.log('\n   👥 Clientes procesados:');
    console.log(`      ✅ ${totalClientes} clientes con prefijos únicos`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('📝 EJEMPLO DE USO:\n');
    console.log('   Cliente con prefijo "ITP":');
    console.log('      Envío 1: ITP-00001');
    console.log('      Envío 2: ITP-00002');
    console.log('      Envío 3: ITP-00003\n');
    
    console.log('🚀 PRÓXIMOS PASOS:');
    console.log('   1. Crear carpeta: utils/');
    console.log('   2. Copiar archivo: tracking-utils.js → utils/');
    console.log('   3. Modificar: routes/envios.js (3 cambios)');
    console.log('   4. Modificar: routes/clientes.js (agregar APIs)');
    console.log('   5. Reiniciar servidor\n');
    
    // Cerrar conexión
    await db.end();
    
    console.log('🎉 ¡Migración ejecutada exitosamente!\n');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ ERROR al ejecutar la migración:');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(error.message);
    
    if (error.code === 'ER_DUP_ENTRY') {
      console.log('\n💡 Sugerencia: Hay prefijos duplicados.');
      console.log('   Esto no debería ocurrir con la nueva versión del script.');
      console.log('   Ejecuta el rollback y vuelve a intentar.\n');
    }
    
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('\n💡 Sugerencia: El campo ya existe.');
      console.log('   Es posible que la migración ya se haya ejecutado.');
      console.log('   Ejecuta el rollback si necesitas volver a ejecutarla.\n');
    }
    
    if (error.code === 'ER_DUP_KEYNAME') {
      console.log('\n💡 Sugerencia: El índice ya existe.');
      console.log('   Esto es normal si estás re-ejecutando la migración.\n');
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