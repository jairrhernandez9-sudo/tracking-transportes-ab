const db = require('./config/database');

async function seedData() {
  try {
    console.log('🌱 Insertando datos de prueba...\n');

    // Obtener el ID del usuario admin
    const [adminUser] = await db.query('SELECT id FROM usuarios WHERE email = ?', ['admin@tracking.com']);
    const adminId = adminUser[0].id;

    // 1. Insertar clientes de prueba
    console.log('👥 Creando clientes...');
    
    const clientes = [
      ['Empresa ABC S.A. de C.V.', 'Juan Pérez', '555-1234', 'contacto@abc.com', 'Av. Reforma 123, CDMX'],
      ['Distribuidora XYZ', 'María González', '555-5678', 'maria@xyz.com', 'Calle Principal 456, Monterrey'],
      ['Comercial 123', 'Carlos Ramírez', '555-9012', 'carlos@comercial123.com', 'Blvd. Norte 789, Guadalajara']
    ];

    for (const cliente of clientes) {
      try {
        await db.query(
          'INSERT INTO clientes (nombre_empresa, contacto, telefono, email, direccion) VALUES (?, ?, ?, ?, ?)',
          cliente
        );
      } catch (err) {
        if (err.code !== 'ER_DUP_ENTRY') {
          console.log('⚠️  Error insertando cliente:', err.message);
        }
      }
    }
    console.log('✅ Clientes creados\n');

    // Obtener IDs de clientes
    const [clientesDb] = await db.query('SELECT id FROM clientes LIMIT 3');

    // 2. Insertar envíos de prueba
    console.log('📦 Creando envíos...');
    
    const envios = [
      {
        numero_tracking: 'TRK-2024-001',
        cliente_id: clientesDb[0]?.id || 1,
        origen: 'Ciudad de México, CDMX',
        destino: 'Monterrey, Nuevo León',
        descripcion: 'Documentos legales urgentes',
        peso: 0.5,
        estado_actual: 'entregado',
        fecha_estimada_entrega: '2024-11-20'
      },
      {
        numero_tracking: 'TRK-2024-002',
        cliente_id: clientesDb[1]?.id || 2,
        origen: 'Guadalajara, Jalisco',
        destino: 'Cancún, Quintana Roo',
        descripcion: 'Equipo electrónico',
        peso: 15.5,
        estado_actual: 'en_transito',
        fecha_estimada_entrega: '2024-11-26'
      },
      {
        numero_tracking: 'TRK-2024-003',
        cliente_id: clientesDb[2]?.id || 3,
        origen: 'Tijuana, Baja California',
        destino: 'Ciudad de México, CDMX',
        descripcion: 'Muestras de producto',
        peso: 3.2,
        estado_actual: 'en_preparacion',
        fecha_estimada_entrega: '2024-11-27'
      },
      {
        numero_tracking: 'TRK-2024-004',
        cliente_id: clientesDb[0]?.id || 1,
        origen: 'Puebla, Puebla',
        destino: 'Mérida, Yucatán',
        descripcion: 'Paquete comercial',
        peso: 8.0,
        estado_actual: 'en_centro_distribucion',
        fecha_estimada_entrega: '2024-11-25'
      },
      {
        numero_tracking: 'TRK-2024-005',
        cliente_id: clientesDb[1]?.id || 2,
        origen: 'Querétaro, Querétaro',
        destino: 'León, Guanajuato',
        descripcion: 'Refacciones industriales',
        peso: 25.8,
        estado_actual: 'despachado',
        fecha_estimada_entrega: '2024-11-24'
      }
    ];

    const envioIds = [];

    for (const envio of envios) {
      try {
        const [result] = await db.query(
          `INSERT INTO envios (numero_tracking, cliente_id, origen, destino, descripcion, peso, estado_actual, fecha_estimada_entrega, usuario_creador_id) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [envio.numero_tracking, envio.cliente_id, envio.origen, envio.destino, envio.descripcion, envio.peso, envio.estado_actual, envio.fecha_estimada_entrega, adminId]
        );
        envioIds.push({ id: result.insertId, tracking: envio.numero_tracking, estado: envio.estado_actual });
        console.log(`✅ Envío ${envio.numero_tracking} creado`);
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          const [existing] = await db.query('SELECT id FROM envios WHERE numero_tracking = ?', [envio.numero_tracking]);
          envioIds.push({ id: existing[0].id, tracking: envio.numero_tracking, estado: envio.estado_actual });
          console.log(`ℹ️  Envío ${envio.numero_tracking} ya existe`);
        } else {
          console.log('⚠️  Error insertando envío:', err.message);
        }
      }
    }
    console.log('✅ Envíos creados\n');

    // 3. Insertar historial de estados
    console.log('📋 Creando historial de estados...');

    // Función auxiliar para crear historial
    const crearHistorial = async (envioId, estados) => {
      for (const estado of estados) {
        try {
          await db.query(
            'INSERT INTO historial_estados (envio_id, estado, ubicacion, comentarios, usuario_id) VALUES (?, ?, ?, ?, ?)',
            [envioId, estado.estado, estado.ubicacion, estado.comentarios, adminId]
          );
        } catch (err) {
          // Ignorar duplicados
        }
      }
    };

    // Historial para envío ENTREGADO (TRK-2024-001)
    if (envioIds[0]) {
      await crearHistorial(envioIds[0].id, [
        { estado: 'creado', ubicacion: 'Ciudad de México, CDMX', comentarios: 'Envío creado y registrado en el sistema' },
        { estado: 'en_preparacion', ubicacion: 'Centro de Distribución CDMX', comentarios: 'Paquete recibido y en proceso de clasificación' },
        { estado: 'despachado', ubicacion: 'Centro de Distribución CDMX', comentarios: 'Paquete despachado en ruta hacia destino' },
        { estado: 'en_transito', ubicacion: 'Carretera México-Monterrey', comentarios: 'En tránsito hacia Monterrey' },
        { estado: 'en_centro_distribucion', ubicacion: 'Centro de Distribución Monterrey', comentarios: 'Llegó a centro de distribución de destino' },
        { estado: 'en_ruta_entrega', ubicacion: 'Monterrey, Nuevo León', comentarios: 'En ruta de entrega local' },
        { estado: 'entregado', ubicacion: 'Monterrey, Nuevo León', comentarios: 'Paquete entregado exitosamente. Recibido por: Juan Pérez' }
      ]);
    }

    // Historial para envío EN TRÁNSITO (TRK-2024-002)
    if (envioIds[1]) {
      await crearHistorial(envioIds[1].id, [
        { estado: 'creado', ubicacion: 'Guadalajara, Jalisco', comentarios: 'Envío creado' },
        { estado: 'en_preparacion', ubicacion: 'Centro de Distribución GDL', comentarios: 'En preparación' },
        { estado: 'despachado', ubicacion: 'Centro de Distribución GDL', comentarios: 'Despachado hacia Cancún' },
        { estado: 'en_transito', ubicacion: 'Carretera hacia Cancún', comentarios: 'En tránsito. ETA: 26/11/2024' }
      ]);
    }

    // Historial para envío EN PREPARACIÓN (TRK-2024-003)
    if (envioIds[2]) {
      await crearHistorial(envioIds[2].id, [
        { estado: 'creado', ubicacion: 'Tijuana, Baja California', comentarios: 'Envío registrado' },
        { estado: 'en_preparacion', ubicacion: 'Centro de Distribución Tijuana', comentarios: 'En proceso de empaquetado y clasificación' }
      ]);
    }

    // Historial para envío EN CENTRO DE DISTRIBUCIÓN (TRK-2024-004)
    if (envioIds[3]) {
      await crearHistorial(envioIds[3].id, [
        { estado: 'creado', ubicacion: 'Puebla, Puebla', comentarios: 'Envío creado' },
        { estado: 'en_preparacion', ubicacion: 'Centro de Distribución Puebla', comentarios: 'Preparando envío' },
        { estado: 'despachado', ubicacion: 'Centro de Distribución Puebla', comentarios: 'Despachado' },
        { estado: 'en_transito', ubicacion: 'En ruta a Mérida', comentarios: 'En tránsito' },
        { estado: 'en_centro_distribucion', ubicacion: 'Centro de Distribución Mérida', comentarios: 'Recibido en centro de distribución. Programando entrega' }
      ]);
    }

    // Historial para envío DESPACHADO (TRK-2024-005)
    if (envioIds[4]) {
      await crearHistorial(envioIds[4].id, [
        { estado: 'creado', ubicacion: 'Querétaro, Querétaro', comentarios: 'Envío creado' },
        { estado: 'en_preparacion', ubicacion: 'Centro de Distribución Querétaro', comentarios: 'En preparación' },
        { estado: 'despachado', ubicacion: 'Centro de Distribución Querétaro', comentarios: 'Despachado hacia León, Guanajuato' }
      ]);
    }

    console.log('✅ Historial de estados creado\n');

    console.log('🎉 ¡Datos de prueba insertados exitosamente!\n');
    console.log('📊 Resumen:');
    console.log(`   • ${clientes.length} clientes`);
    console.log(`   • ${envios.length} envíos`);
    console.log('   • Múltiples estados en historial\n');
    console.log('🔍 Números de tracking para probar:');
    envioIds.forEach(e => {
      console.log(`   • ${e.tracking} (${e.estado})`);
    });
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

seedData();