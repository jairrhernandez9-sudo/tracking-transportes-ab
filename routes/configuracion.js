const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Middleware para verificar que solo admins accedan
router.use(isAuthenticated);
router.use(isAdmin);

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

// Página principal de configuración
router.get('/', async (req, res) => {
  try {
    const configuracion = await obtenerConfiguracion();
    
    res.render('configuracion/index', {
      title: 'Configuración del Sistema',
      user: {
        id: req.session.userId,
        nombre: req.session.userName,
        email: req.session.userEmail,
        rol: req.session.userRole
      },
      config: configuracion,
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
    const { tracking_publico_activo, mostrar_fotos_tracking } = req.body;
    
    const updates = [
      ['tracking_publico_activo', tracking_publico_activo ? 'true' : 'false'],
      ['mostrar_fotos_tracking', mostrar_fotos_tracking ? 'true' : 'false']
    ];
    
    for (const [clave, valor] of updates) {
      await db.query(
        'UPDATE configuracion_sistema SET valor = ?, modificado_por = ? WHERE clave = ?',
        [valor, req.session.userId, clave]
      );
    }
    
    res.redirect('/configuracion?success=tracking_actualizado');
  } catch (error) {
    console.error('Error al actualizar tracking:', error);
    res.redirect('/configuracion?error=error_servidor');
  }
});

module.exports = router;