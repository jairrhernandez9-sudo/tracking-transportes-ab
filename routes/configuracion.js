const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Middleware para verificar que solo admins accedan
router.use(isAuthenticated);

// Obtener configuración
async function obtenerConfiguracion() {
  const [configs] = await db.query('SELECT * FROM configuracion_sistema ORDER BY categoria, clave');
  
  const configuracion = {
    empresa: {},
    tarifas: {},
    notificaciones: {},
    alertas: {},
    tracking: {}
  };
  
  configs.forEach(config => {
    let valor = config.valor;
    
    // Convertir según tipo
    if (config.tipo === 'numero') {
      valor = parseFloat(valor) || 0;
    } else if (config.tipo === 'boolean') {
      valor = valor === 'true';
    } else if (config.tipo === 'json') {
      try {
        valor = JSON.parse(valor);
      } catch (e) {
        valor = {};
      }
    }
    
    if (configuracion[config.categoria]) {
      configuracion[config.categoria][config.clave] = valor;
    }
  });
  
  return configuracion;
}

// ⬅️ NUEVA FUNCIÓN: Obtener direcciones de empresa
async function obtenerDireccionesEmpresa() {
  const [direcciones] = await db.query(`
    SELECT * FROM direcciones_empresa 
    WHERE activa = 1 
    ORDER BY es_predeterminada DESC, alias ASC
  `);
  return direcciones;
}

// Página principal de configuración ⬅️ MODIFICADA
router.get('/', async (req, res) => {
  try {
    const configuracion = await obtenerConfiguracion();
    const direccionesEmpresa = await obtenerDireccionesEmpresa(); // ⬅️ AGREGADO
    
    res.render('configuracion/index', {
      title: 'Configuración del Sistema',
      user: {
        id: req.session.userId,
        nombre: req.session.userName,
        email: req.session.userEmail,
        rol: req.session.userRole
      },
      config: configuracion,
      direccionesEmpresa, // ⬅️ AGREGADO
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    console.error('Error al cargar configuración:', error);
    res.status(500).send('Error al cargar configuración');
  }
});

// Actualizar configuración de empresa
router.post('/empresa', async (req, res) => {
  try {
    const { empresa_nombre, empresa_rfc, empresa_telefono, empresa_email, empresa_direccion, empresa_sitio_web } = req.body;
    
    const updates = [
      ['empresa_nombre', empresa_nombre],
      ['empresa_rfc', empresa_rfc],
      ['empresa_telefono', empresa_telefono],
      ['empresa_email', empresa_email],
      ['empresa_direccion', empresa_direccion],
      ['empresa_sitio_web', empresa_sitio_web]
    ];
    
    for (const [clave, valor] of updates) {
      await db.query(
        'UPDATE configuracion_sistema SET valor = ?, modificado_por = ? WHERE clave = ?',
        [valor || '', req.session.userId, clave]
      );
    }
    
    res.redirect('/configuracion?success=empresa_actualizada');
  } catch (error) {
    console.error('Error al actualizar empresa:', error);
    res.redirect('/configuracion?error=error_servidor');
  }
});

// Actualizar tarifas
router.post('/tarifas', async (req, res) => {
  try {
    const { tarifa_base, tarifa_por_km, tarifa_seguro, iva_porcentaje } = req.body;
    
    const updates = [
      ['tarifa_base', tarifa_base],
      ['tarifa_por_km', tarifa_por_km],
      ['tarifa_seguro', tarifa_seguro],
      ['iva_porcentaje', iva_porcentaje]
    ];
    
    for (const [clave, valor] of updates) {
      await db.query(
        'UPDATE configuracion_sistema SET valor = ?, modificado_por = ? WHERE clave = ?',
        [valor || '0', req.session.userId, clave]
      );
    }
    
    res.redirect('/configuracion?success=tarifas_actualizadas');
  } catch (error) {
    console.error('Error al actualizar tarifas:', error);
    res.redirect('/configuracion?error=error_servidor');
  }
});

// Actualizar notificaciones
router.post('/notificaciones', async (req, res) => {
  try {
    const {
      notif_email_activo,
      notif_sms_activo,
      notif_envio_creado,
      notif_envio_entregado,
      notif_envio_retrasado
    } = req.body;
    
    const updates = [
      ['notif_email_activo', notif_email_activo ? 'true' : 'false'],
      ['notif_sms_activo', notif_sms_activo ? 'true' : 'false'],
      ['notif_envio_creado', notif_envio_creado ? 'true' : 'false'],
      ['notif_envio_entregado', notif_envio_entregado ? 'true' : 'false'],
      ['notif_envio_retrasado', notif_envio_retrasado ? 'true' : 'false']
    ];
    
    for (const [clave, valor] of updates) {
      await db.query(
        'UPDATE configuracion_sistema SET valor = ?, modificado_por = ? WHERE clave = ?',
        [valor, req.session.userId, clave]
      );
    }
    
    res.redirect('/configuracion?success=notificaciones_actualizadas');
  } catch (error) {
    console.error('Error al actualizar notificaciones:', error);
    res.redirect('/configuracion?error=error_servidor');
  }
});

// Actualizar alertas
router.post('/alertas', async (req, res) => {
  try {
    const { dias_alerta_retraso, auto_cancelar_dias } = req.body;
    
    const updates = [
      ['dias_alerta_retraso', dias_alerta_retraso],
      ['auto_cancelar_dias', auto_cancelar_dias]
    ];
    
    for (const [clave, valor] of updates) {
      await db.query(
        'UPDATE configuracion_sistema SET valor = ?, modificado_por = ? WHERE clave = ?',
        [valor || '0', req.session.userId, clave]
      );
    }
    
    res.redirect('/configuracion?success=alertas_actualizadas');
  } catch (error) {
    console.error('Error al actualizar alertas:', error);
    res.redirect('/configuracion?error=error_servidor');
  }
});

// Actualizar tracking
router.post('/tracking', async (req, res) => {
  try {
    const {
      tracking_publico_activo,
      mostrar_fotos_tracking,
      mostrar_pdfs_tracking,
      mostrar_comentarios_tracking,
      mostrar_ubicaciones_tracking,
      mostrar_info_cliente_tracking,
      mostrar_datos_envio_tracking,
      mostrar_historial_completo_tracking,
      mostrar_qr_tracking,
      mostrar_boton_pdf_tracking,
      mostrar_boton_whatsapp_tracking,
      mostrar_boton_copiar_tracking,
      mostrar_seccion_features,
      mostrar_seccion_stats,
      mostrar_seccion_como_funciona,
      mostrar_seccion_cta
    } = req.body;
    
    const updates = [
      ['tracking_publico_activo', tracking_publico_activo ? 'true' : 'false'],
      ['mostrar_fotos_tracking', mostrar_fotos_tracking ? 'true' : 'false'],
      ['mostrar_pdfs_tracking', mostrar_pdfs_tracking ? 'true' : 'false'],
      ['mostrar_comentarios_tracking', mostrar_comentarios_tracking ? 'true' : 'false'],
      ['mostrar_ubicaciones_tracking', mostrar_ubicaciones_tracking ? 'true' : 'false'],
      ['mostrar_info_cliente_tracking', mostrar_info_cliente_tracking ? 'true' : 'false'],
      ['mostrar_datos_envio_tracking', mostrar_datos_envio_tracking ? 'true' : 'false'],
      ['mostrar_historial_completo_tracking', mostrar_historial_completo_tracking ? 'true' : 'false'],
      ['mostrar_qr_tracking', mostrar_qr_tracking ? 'true' : 'false'],
      ['mostrar_boton_pdf_tracking', mostrar_boton_pdf_tracking ? 'true' : 'false'],
      ['mostrar_boton_whatsapp_tracking', mostrar_boton_whatsapp_tracking ? 'true' : 'false'],
      ['mostrar_boton_copiar_tracking', mostrar_boton_copiar_tracking ? 'true' : 'false'],
      ['mostrar_seccion_features', mostrar_seccion_features ? 'true' : 'false'],
      ['mostrar_seccion_stats', mostrar_seccion_stats ? 'true' : 'false'],
      ['mostrar_seccion_como_funciona', mostrar_seccion_como_funciona ? 'true' : 'false'],
      ['mostrar_seccion_cta', mostrar_seccion_cta ? 'true' : 'false']
    ];
    
    for (const [clave, valor] of updates) {
      await db.query(
        'UPDATE configuracion_sistema SET valor = ?, modificado_por = ? WHERE clave = ?',
        [valor, req.session.userId, clave]
      );
    }
    
    console.log('✅ Configuración de tracking actualizada');
    res.redirect('/configuracion?success=tracking_actualizado');
  } catch (error) {
    console.error('Error al actualizar tracking:', error);
    res.redirect('/configuracion?error=error_servidor');
  }
});

// ============================================
// ⬅️ NUEVAS RUTAS: GESTIÓN DE DIRECCIONES DE EMPRESA
// ============================================

// Crear nueva dirección de empresa
router.post('/direcciones/nueva', async (req, res) => {
  try {
    const { alias, calle, colonia, ciudad, estado, cp, referencia, es_predeterminada } = req.body;
    
    // Validar campos obligatorios
    if (!alias || !calle || !colonia || !ciudad || !estado || !cp) {
      return res.redirect('/configuracion?error=campos_faltantes');
    }
    
    // Si se marca como predeterminada, quitar predeterminada de las demás
    if (es_predeterminada === 'on') {
      await db.query('UPDATE direcciones_empresa SET es_predeterminada = 0');
    }
    
    // Insertar nueva dirección
    await db.query(`
      INSERT INTO direcciones_empresa 
      (alias, calle, colonia, ciudad, estado, cp, referencia, es_predeterminada, activa)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      alias,
      calle,
      colonia,
      ciudad,
      estado,
      cp,
      referencia || null,
      es_predeterminada === 'on' ? 1 : 0
    ]);
    
    console.log('✅ Dirección de empresa creada:', alias);
    res.redirect('/configuracion?success=direccion_creada');
    
  } catch (error) {
    console.error('Error al crear dirección:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.redirect('/configuracion?error=alias_duplicado');
    }
    
    res.redirect('/configuracion?error=error_servidor');
  }
});

// Editar dirección de empresa
router.post('/direcciones/:id/editar', async (req, res) => {
  try {
    const { id } = req.params;
    const { alias, calle, colonia, ciudad, estado, cp, referencia, es_predeterminada } = req.body;
    
    // Validar campos obligatorios
    if (!alias || !calle || !colonia || !ciudad || !estado || !cp) {
      return res.redirect('/configuracion?error=campos_faltantes');
    }
    
    // Si se marca como predeterminada, quitar predeterminada de las demás
    if (es_predeterminada === 'on') {
      await db.query('UPDATE direcciones_empresa SET es_predeterminada = 0');
    }
    
    // Actualizar dirección
    await db.query(`
      UPDATE direcciones_empresa 
      SET alias = ?, calle = ?, colonia = ?, ciudad = ?, estado = ?, cp = ?, referencia = ?, es_predeterminada = ?
      WHERE id = ?
    `, [
      alias,
      calle,
      colonia,
      ciudad,
      estado,
      cp,
      referencia || null,
      es_predeterminada === 'on' ? 1 : 0,
      id
    ]);
    
    console.log('✅ Dirección actualizada:', id);
    res.redirect('/configuracion?success=direccion_actualizada');
    
  } catch (error) {
    console.error('Error al editar dirección:', error);
    res.redirect('/configuracion?error=error_servidor');
  }
});

// Eliminar dirección de empresa (soft delete)
router.post('/direcciones/:id/eliminar', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar que no sea la única dirección
    const [count] = await db.query(
      'SELECT COUNT(*) as total FROM direcciones_empresa WHERE activa = 1'
    );
    
    if (count[0].total <= 1) {
      return res.redirect('/configuracion?error=ultima_direccion');
    }
    
    // Soft delete
    await db.query('UPDATE direcciones_empresa SET activa = 0 WHERE id = ?', [id]);
    
    // Si era predeterminada, marcar otra como predeterminada
    const [predeterminada] = await db.query(
      'SELECT id FROM direcciones_empresa WHERE activa = 1 ORDER BY id ASC LIMIT 1'
    );
    
    if (predeterminada.length > 0) {
      await db.query(
        'UPDATE direcciones_empresa SET es_predeterminada = 1 WHERE id = ?',
        [predeterminada[0].id]
      );
    }
    
    console.log('✅ Dirección eliminada:', id);
    res.redirect('/configuracion?success=direccion_eliminada');
    
  } catch (error) {
    console.error('Error al eliminar dirección:', error);
    res.redirect('/configuracion?error=error_servidor');
  }
});

// Marcar dirección como predeterminada
router.post('/direcciones/:id/predeterminada', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Quitar predeterminada de todas
    await db.query('UPDATE direcciones_empresa SET es_predeterminada = 0');
    
    // Marcar esta como predeterminada
    await db.query('UPDATE direcciones_empresa SET es_predeterminada = 1 WHERE id = ?', [id]);
    
    console.log('✅ Dirección marcada como predeterminada:', id);
    res.redirect('/configuracion?success=predeterminada_actualizada');
    
  } catch (error) {
    console.error('Error al marcar predeterminada:', error);
    res.redirect('/configuracion?error=error_servidor');
  }
});



// ============================================
// API: OBTENER DIRECCIONES DE EMPRESA (JSON)
// ============================================
router.get('/api/direcciones', isAuthenticated, async (req, res) => {
  try {
    const [direcciones] = await db.query(`
      SELECT * FROM direcciones_empresa 
      WHERE activa = 1 
      ORDER BY es_predeterminada DESC, alias ASC
    `);
    res.json({ success: true, direcciones });
  } catch (error) {
    console.error('Error al obtener direcciones empresa:', error);
    res.status(500).json({ success: false, message: 'Error al cargar direcciones' });
  }
});

module.exports = router;