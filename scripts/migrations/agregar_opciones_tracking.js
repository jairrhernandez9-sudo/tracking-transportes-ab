/**
 * MIGRACIÓN: Agregar opciones de tracking público
 * Fecha: 2025-01-23
 * Descripción: Agrega configuraciones granulares para el tracking público
 * 
 * USO:
 *   node scripts/migrations/agregar_opciones_tracking.js
 */

const db = require('../../config/database');

async function ejecutarMigracion() {
  console.log('🚀 Iniciando migración: Agregar opciones de tracking público...\n');
  
  try {
    // Verificar si la tabla existe
    const [tables] = await db.query(`
      SHOW TABLES LIKE 'configuracion_sistema'
    `);
    
    if (tables.length === 0) {
      console.error('❌ ERROR: La tabla configuracion_sistema no existe.');
      console.log('   Asegúrate de haber creado la tabla primero.');
      process.exit(1);
    }
    
    console.log('✅ Tabla configuracion_sistema encontrada\n');
    
    // Configuraciones a insertar
    const configuraciones = [
      // PDFs
      {
        categoria: 'tracking',
        clave: 'mostrar_pdfs_tracking',
        valor: 'true',
        tipo: 'boolean',
        descripcion: 'Mostrar PDFs adjuntos en el tracking público'
      },
      
      // Información del Envío
      {
        categoria: 'tracking',
        clave: 'mostrar_comentarios_tracking',
        valor: 'true',
        tipo: 'boolean',
        descripcion: 'Mostrar comentarios de operadores en tracking público'
      },
      {
        categoria: 'tracking',
        clave: 'mostrar_ubicaciones_tracking',
        valor: 'true',
        tipo: 'boolean',
        descripcion: 'Mostrar ubicaciones detalladas en tracking público'
      },
      {
        categoria: 'tracking',
        clave: 'mostrar_info_cliente_tracking',
        valor: 'true',
        tipo: 'boolean',
        descripcion: 'Mostrar nombre de la empresa cliente en tracking público'
      },
      {
        categoria: 'tracking',
        clave: 'mostrar_datos_envio_tracking',
        valor: 'true',
        tipo: 'boolean',
        descripcion: 'Mostrar peso y descripción en tracking público'
      },
      {
        categoria: 'tracking',
        clave: 'mostrar_historial_completo_tracking',
        valor: 'true',
        tipo: 'boolean',
        descripcion: 'Mostrar historial completo de estados'
      },
      
      // Funcionalidades
      {
        categoria: 'tracking',
        clave: 'mostrar_qr_tracking',
        valor: 'true',
        tipo: 'boolean',
        descripcion: 'Mostrar código QR para compartir'
      },
      {
        categoria: 'tracking',
        clave: 'mostrar_boton_pdf_tracking',
        valor: 'true',
        tipo: 'boolean',
        descripcion: 'Mostrar botón para exportar PDF'
      },
      {
        categoria: 'tracking',
        clave: 'mostrar_boton_whatsapp_tracking',
        valor: 'true',
        tipo: 'boolean',
        descripcion: 'Mostrar botón para compartir por WhatsApp'
      },
      {
        categoria: 'tracking',
        clave: 'mostrar_boton_copiar_tracking',
        valor: 'true',
        tipo: 'boolean',
        descripcion: 'Mostrar botón para copiar enlace'
      },
      
      // Secciones Informativas
      {
        categoria: 'tracking',
        clave: 'mostrar_seccion_features',
        valor: 'true',
        tipo: 'boolean',
        descripcion: 'Mostrar sección "¿Por qué elegirnos?"'
      },
      {
        categoria: 'tracking',
        clave: 'mostrar_seccion_stats',
        valor: 'true',
        tipo: 'boolean',
        descripcion: 'Mostrar sección de estadísticas'
      },
      {
        categoria: 'tracking',
        clave: 'mostrar_seccion_como_funciona',
        valor: 'true',
        tipo: 'boolean',
        descripcion: 'Mostrar sección "¿Cómo funciona?"'
      },
      {
        categoria: 'tracking',
        clave: 'mostrar_seccion_cta',
        valor: 'true',
        tipo: 'boolean',
        descripcion: 'Mostrar sección de contacto/CTA'
      }
    ];
    
    let insertadas = 0;
    let yaExistentes = 0;
    
    console.log('📝 Insertando configuraciones...\n');
    
    for (const config of configuraciones) {
      // Verificar si ya existe
      const [existing] = await db.query(
        'SELECT id FROM configuracion_sistema WHERE clave = ?',
        [config.clave]
      );
      
      if (existing.length > 0) {
        console.log(`   ⚠️  ${config.clave} - Ya existe, se omite`);
        yaExistentes++;
        continue;
      }
      
      // Insertar nueva configuración
      await db.query(
        `INSERT INTO configuracion_sistema (categoria, clave, valor, tipo, descripcion)
         VALUES (?, ?, ?, ?, ?)`,
        [config.categoria, config.clave, config.valor, config.tipo, config.descripcion]
      );
      
      console.log(`   ✅ ${config.clave} - Insertada correctamente`);
      insertadas++;
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ MIGRACIÓN COMPLETADA\n');
    console.log(`   📊 Configuraciones insertadas: ${insertadas}`);
    console.log(`   ⚠️  Configuraciones ya existentes: ${yaExistentes}`);
    console.log(`   📝 Total procesadas: ${configuraciones.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Verificar que se insertaron correctamente
    const [result] = await db.query(
      `SELECT COUNT(*) as total 
       FROM configuracion_sistema 
       WHERE categoria = 'tracking'`
    );
    
    console.log(`✅ Total de configuraciones de tracking en la BD: ${result[0].total}\n`);
    
    // Cerrar conexión
    await db.end();
    
    console.log('🎉 ¡Migración ejecutada exitosamente!\n');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ ERROR al ejecutar la migración:');
    console.error(error);
    
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