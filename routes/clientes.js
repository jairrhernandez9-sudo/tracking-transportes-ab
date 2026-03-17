const { requireAdmin, requireAdminOrOperator, requireAdminOrSuper } = require('../middleware/roles');
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { isAuthenticated } = require('../middleware/auth');
// ⬅️ NUEVO: Importar funciones de tracking
const {
  generarPrefijoUnico,
  prefijoDisponible,
  validarFormatoPrefijo
} = require('../utils/tracking-utils');

// ============================================
// APIs PARA PREFIJOS (NUEVO)
// ============================================

/**
 * API: Sugerir prefijo automático basado en nombre de empresa
 * GET /clientes/api/sugerir-prefijo?nombre=IT+Piezas
 */
router.get('/api/sugerir-prefijo', isAuthenticated, async (req, res) => {
  try {
    const { nombre } = req.query;
    
    if (!nombre) {
      return res.json({ 
        success: false, 
        error: 'El nombre de la empresa es requerido' 
      });
    }
    
    const prefijoSugerido = await generarPrefijoUnico(nombre);
    
    res.json({
      success: true,
      prefijo: prefijoSugerido,
      disponible: true
    });
    
  } catch (error) {
    console.error('Error sugiriendo prefijo:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al generar sugerencia de prefijo' 
    });
  }
});

/**
 * API: Verificar disponibilidad de un prefijo
 * GET /clientes/api/verificar-prefijo?prefijo=ITP&clienteId=5
 */
router.get('/api/verificar-prefijo', isAuthenticated, async (req, res) => {
  try {
    const { prefijo, clienteId } = req.query;
    
    if (!prefijo) {
      return res.json({ 
        success: false, 
        error: 'El prefijo es requerido' 
      });
    }
    
    // Validar formato
    const validacion = validarFormatoPrefijo(prefijo);
    if (!validacion.valido) {
      return res.json({
        success: false,
        disponible: false,
        error: validacion.error
      });
    }
    
    const prefijoUpper = prefijo.toUpperCase();
    
    // Verificar si está disponible (excluyendo el cliente actual si es edición)
    let query = 'SELECT COUNT(*) as count FROM clientes WHERE prefijo_tracking = ? AND eliminado_en IS NULL';
    const params = [prefijoUpper];
    
    if (clienteId) {
      query += ' AND id != ?';
      params.push(clienteId);
    }
    
    const [result] = await db.query(query, params);
    const disponible = result[0].count === 0;
    
    res.json({
      success: true,
      disponible: disponible,
      prefijo: prefijoUpper,
      mensaje: disponible 
        ? '✓ Prefijo disponible' 
        : '✗ Este prefijo ya está en uso'
    });
    
  } catch (error) {
    console.error('Error verificando prefijo:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al verificar disponibilidad del prefijo' 
    });
  }
});

// ============================================
// LISTADO DE CLIENTES
// ============================================
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { buscar, orderBy } = req.query;
    const esOperador = req.session.userRole === 'operador';

    let query = esOperador
      ? 'SELECT c.* FROM clientes c INNER JOIN cliente_operadores co ON co.cliente_id = c.id WHERE c.eliminado_en IS NULL AND co.usuario_id = ?'
      : 'SELECT * FROM clientes WHERE eliminado_en IS NULL';
    const params = esOperador ? [req.session.userId] : [];

    // Filtro de búsqueda
    if (buscar) {
      query += ` AND (${esOperador ? 'c.' : ''}nombre_empresa LIKE ? OR ${esOperador ? 'c.' : ''}contacto LIKE ? OR ${esOperador ? 'c.' : ''}email LIKE ? OR ${esOperador ? 'c.' : ''}telefono LIKE ?)`;
      const searchTerm = `%${buscar}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Ordenamiento
    const order = orderBy === 'antiguo' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${esOperador ? 'c.' : ''}fecha_creacion ${order}`;

    const [clientes] = await db.query(query, params);
    
    // Obtener cantidad de envíos por cliente
    for (let cliente of clientes) {
      const [envios] = await db.query(
        'SELECT COUNT(*) as total FROM envios WHERE cliente_id = ?',
        [cliente.id]
      );
      cliente.total_envios = envios[0].total;
    }
    
    res.render('clientes/lista', {
      title: 'Gestión de Clientes',
      user: {
        nombre: req.session.userName,
        email: req.session.userEmail,
        rol: req.session.userRole
      },
      clientes,
      filtros: { buscar: buscar || '', orderBy: orderBy || 'reciente' }
    });
    
  } catch (error) {
    console.error('Error al cargar clientes:', error);
    res.status(500).send('Error al cargar los clientes');
  }
});

// ============================================
// FORMULARIO NUEVO CLIENTE
// ============================================
router.get('/nuevo', isAuthenticated, requireAdminOrSuper, async (req, res) => {
  const [etiquetaTemplates] = await db.query('SELECT id, nombre FROM etiqueta_templates ORDER BY nombre ASC').catch(() => [[]]);
  const [guiaTemplates] = await db.query('SELECT id, nombre FROM guia_templates ORDER BY nombre ASC').catch(() => [[]]);
  const [[cfgCredito]] = await db.query("SELECT valor FROM configuracion_sistema WHERE clave = 'credito_habilitado'").catch(() => [[null]]);
  const creditoHabilitado = !cfgCredito || cfgCredito.valor !== 'false';
  const [operadores] = await db.query("SELECT id, nombre, email FROM usuarios WHERE rol = 'operador' AND activo = 1 ORDER BY nombre ASC").catch(() => [[]]);
  res.render('clientes/nuevo', {
    title: 'Nuevo Cliente',
    user: {
      nombre: req.session.userName,
      email: req.session.userEmail,
      rol: req.session.userRole
    },
    etiquetaTemplates,
    guiaTemplates,
    creditoHabilitado,
    operadores,
    error: null
  });
});

// ============================================
// CREAR CLIENTE (POST) - MODIFICADO
// ============================================
router.post('/nuevo', isAuthenticated, requireAdminOrSuper, async (req, res) => {
  try {
    const {
      nombre_empresa,
      contacto,
      telefono,
      email,
      direccion,
      prefijo_tracking_manual,
      template_etiqueta_id,
      template_guia_id,
      metodo_pago_defecto
    } = req.body;

    // Validar campos requeridos
    if (!nombre_empresa || !email) {
      const [etiquetaTemplates] = await db.query('SELECT id, nombre FROM etiqueta_templates ORDER BY nombre ASC').catch(() => [[]]);
      const [guiaTemplates] = await db.query('SELECT id, nombre FROM guia_templates ORDER BY nombre ASC').catch(() => [[]]);
      return res.render('clientes/nuevo', {
        title: 'Nuevo Cliente',
        user: { nombre: req.session.userName, email: req.session.userEmail, rol: req.session.userRole },
        etiquetaTemplates,
        guiaTemplates,
        error: 'Nombre de empresa y email son obligatorios'
      });
    }

    // Verificar si el email ya existe
    const [existente] = await db.query(
      'SELECT id FROM clientes WHERE email = ? AND eliminado_en IS NULL',
      [email]
    );

    if (existente.length > 0) {
      const [etiquetaTemplates] = await db.query('SELECT id, nombre FROM etiqueta_templates ORDER BY nombre ASC').catch(() => [[]]);
      const [guiaTemplates] = await db.query('SELECT id, nombre FROM guia_templates ORDER BY nombre ASC').catch(() => [[]]);
      return res.render('clientes/nuevo', {
        title: 'Nuevo Cliente',
        user: { nombre: req.session.userName, email: req.session.userEmail, rol: req.session.userRole },
        etiquetaTemplates,
        guiaTemplates,
        error: 'Ya existe un cliente con ese email'
      });
    }

    // ⬅️ NUEVO: Determinar el prefijo a usar
    let prefijoFinal;
    
    if (prefijo_tracking_manual && prefijo_tracking_manual.trim() !== '') {
      // El usuario proporcionó un prefijo manualmente
      const validacion = validarFormatoPrefijo(prefijo_tracking_manual);
      
      if (!validacion.valido) {
        return res.render('clientes/nuevo', {
          title: 'Nuevo Cliente',
          user: {
            nombre: req.session.userName,
            email: req.session.userEmail,
            rol: req.session.userRole
          },
          error: validacion.error
        });
      }
      
      prefijoFinal = prefijo_tracking_manual.toUpperCase();
      
      // Verificar disponibilidad
      const disponible = await prefijoDisponible(prefijoFinal);
      if (!disponible) {
        return res.render('clientes/nuevo', {
          title: 'Nuevo Cliente',
          user: {
            nombre: req.session.userName,
            email: req.session.userEmail,
            rol: req.session.userRole
          },
          error: 'El prefijo ya está en uso'
        });
      }
    } else {
      // Generar prefijo automáticamente
      prefijoFinal = await generarPrefijoUnico(nombre_empresa);
    }
    
    // ⬅️ MODIFICADO: Insertar cliente con prefijo
    const tplId = parseInt(template_etiqueta_id) || null;
    const guiaTplId = parseInt(template_guia_id) || null;
    const metodoPago = ['PUE', 'PPD'].includes(metodo_pago_defecto) ? metodo_pago_defecto : 'PPD';
    const [result] = await db.query(
      `INSERT INTO clientes
      (nombre_empresa, contacto, telefono, email, direccion, prefijo_tracking, ultimo_numero_tracking, template_etiqueta_id, template_guia_id, metodo_pago_defecto)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [nombre_empresa, contacto, telefono, email, direccion, prefijoFinal, tplId, guiaTplId, metodoPago]
    );

    // Asignar operadores seleccionados
    const opIds = [].concat(req.body.operador_ids || []).map(Number).filter(Boolean);
    if (opIds.length > 0) {
      const rows = opIds.map(uid => [result.insertId, uid]);
      await db.query('INSERT INTO cliente_operadores (cliente_id, usuario_id) VALUES ?', [rows]);
    }

    res.redirect('/clientes?success=created');
    
  } catch (error) {
    console.error('Error al crear cliente:', error);
    
    // Si es error de prefijo duplicado (por race condition)
    if (error.code === 'ER_DUP_ENTRY' && error.message.includes('prefijo_tracking')) {
      return res.render('clientes/nuevo', {
        title: 'Nuevo Cliente',
        user: {
          nombre: req.session.userName,
          email: req.session.userEmail,
          rol: req.session.userRole
        },
        error: 'El prefijo ya está en uso. Por favor elige otro.'
      });
    }
    
    res.render('clientes/nuevo', {
      title: 'Nuevo Cliente',
      user: {
        nombre: req.session.userName,
        email: req.session.userEmail,
        rol: req.session.userRole
      },
      error: 'Error al crear el cliente. Por favor intenta de nuevo.'
    });
  }
});

// ============================================
// VER DETALLE DE CLIENTE
// ============================================
// ============================================
// CLIENTES ELIMINADOS (solo admin)
// ============================================
router.get('/eliminados', isAuthenticated, requireAdmin, async (req, res) => {
  try {
    const [clientes] = await db.query(
      'SELECT * FROM clientes WHERE eliminado_en IS NOT NULL ORDER BY eliminado_en DESC'
    );
    
    // Obtener total de envíos por cliente eliminado
    for (let cliente of clientes) {
      const [envios] = await db.query(
        'SELECT COUNT(*) as total FROM envios WHERE cliente_id = ?',
        [cliente.id]
      );
      cliente.total_envios = envios[0].total;
    }
    
    res.render('clientes/eliminados', {
      title: 'Clientes Eliminados',
      user: {
        nombre: req.session.userName,
        email: req.session.userEmail,
        rol: req.session.userRole
      },
      clientes
    });
  } catch (error) {
    console.error('Error al cargar clientes eliminados:', error);
    res.status(500).send('Error al cargar los clientes eliminados');
  }
});

router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Obtener cliente
    const [clientes] = await db.query('SELECT * FROM clientes WHERE id = ?', [id]);
    
    if (clientes.length === 0) {
      return res.status(404).send('Cliente no encontrado');
    }
    
    const cliente = clientes[0];
    
    // Obtener envíos del cliente
    const [envios] = await db.query(
      `SELECT e.*,
        (SELECT COUNT(*) FROM envio_pictogramas ep WHERE ep.envio_id = e.id) AS tiene_pictogramas
       FROM envios e
       WHERE e.cliente_id = ?
       ORDER BY e.fecha_creacion DESC
       LIMIT 10`,
      [id]
    );
    
    // Obtener estadísticas
    const [stats] = await db.query(
      `SELECT 
        COUNT(*) as total_envios,
        SUM(CASE WHEN estado_actual = 'entregado' THEN 1 ELSE 0 END) as entregados,
        SUM(CASE WHEN estado_actual IN ('en_transito', 'en_ruta_entrega') THEN 1 ELSE 0 END) as en_transito
       FROM envios 
       WHERE cliente_id = ?`,
      [id]
    );
    
    // Obtener direcciones del cliente
    const [direcciones] = await db.query(`
      SELECT * FROM direcciones_cliente 
      WHERE cliente_id = ? AND activa = 1 
      ORDER BY es_predeterminada DESC, alias ASC
    `, [id]);
    
    res.render('clientes/detalle', {
      title: cliente.nombre_empresa,
      user: {
        nombre: req.session.userName,
        email: req.session.userEmail,
        rol: req.session.userRole
      },
      cliente,
      envios,
      stats: stats[0],
       direcciones, 
      success: req.query.success, 
      error: req.query.error 
    });
    
  } catch (error) {
    console.error('Error al cargar detalle:', error);
    res.status(500).send('Error al cargar el detalle del cliente');
  }
});

// ============================================
// EDITAR CLIENTE (GET)
// ============================================
router.get('/:id/editar', isAuthenticated, requireAdminOrSuper, async (req, res) => {
  try {
    const { id } = req.params;

    const [clientes] = await db.query('SELECT * FROM clientes WHERE id = ?', [id]);

    if (clientes.length === 0) {
      return res.status(404).send('Cliente no encontrado');
    }

    const [etiquetaTemplates] = await db.query('SELECT id, nombre FROM etiqueta_templates ORDER BY nombre ASC').catch(() => [[]]);
    const [guiaTemplates] = await db.query('SELECT id, nombre FROM guia_templates ORDER BY nombre ASC').catch(() => [[]]);
    const [[cfgCredito]] = await db.query("SELECT valor FROM configuracion_sistema WHERE clave = 'credito_habilitado'").catch(() => [[null]]);
    const creditoHabilitado = !cfgCredito || cfgCredito.valor !== 'false';
    const [operadores] = await db.query("SELECT id, nombre, email FROM usuarios WHERE rol = 'operador' AND activo = 1 ORDER BY nombre ASC").catch(() => [[]]);
    const [asignados] = await db.query('SELECT usuario_id FROM cliente_operadores WHERE cliente_id = ?', [id]).catch(() => [[]]);
    const operadoresAsignados = asignados.map(r => r.usuario_id);

    res.render('clientes/editar', {
      title: 'Editar Cliente',
      user: {
        nombre: req.session.userName,
        email: req.session.userEmail,
        rol: req.session.userRole
      },
      cliente: clientes[0],
      etiquetaTemplates,
      guiaTemplates,
      creditoHabilitado,
      operadores,
      operadoresAsignados,
      error: null
    });
    
  } catch (error) {
    console.error('Error al cargar formulario:', error);
    res.status(500).send('Error al cargar el formulario');
  }
});

// ============================================
// EDITAR CLIENTE (POST) - MODIFICADO
// ============================================
router.post('/:id/editar', isAuthenticated, requireAdminOrSuper, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre_empresa,
      contacto,
      telefono,
      email,
      direccion,
      prefijo_tracking_manual,
      template_etiqueta_id,
      template_guia_id,
      metodo_pago_defecto
    } = req.body;

    // Cargar vars necesarias para cualquier render de error
    const [etiquetaTemplates] = await db.query('SELECT id, nombre FROM etiqueta_templates ORDER BY nombre ASC').catch(() => [[]]);
    const [guiaTemplates]     = await db.query('SELECT id, nombre FROM guia_templates ORDER BY nombre ASC').catch(() => [[]]);
    const [[cfgCredito]]      = await db.query("SELECT valor FROM configuracion_sistema WHERE clave = 'credito_habilitado'").catch(() => [[null]]);
    const creditoHabilitado   = !cfgCredito || cfgCredito.valor !== 'false';

    const renderError = async (errorMsg) => {
      const [clientes] = await db.query('SELECT * FROM clientes WHERE id = ?', [id]);
      return res.render('clientes/editar', {
        title: 'Editar Cliente',
        user: { nombre: req.session.userName, email: req.session.userEmail, rol: req.session.userRole },
        cliente: clientes[0],
        etiquetaTemplates,
        guiaTemplates,
        creditoHabilitado,
        error: errorMsg
      });
    };

    // Validar campos requeridos
    if (!nombre_empresa || !email) {
      return renderError('Nombre de empresa y email son obligatorios');
    }

    // Obtener cliente actual para verificar prefijo
    const [clienteActual] = await db.query(
      'SELECT prefijo_tracking, ultimo_numero_tracking FROM clientes WHERE id = ?',
      [id]
    );

    if (clienteActual.length === 0) {
      return res.redirect('/clientes?error=cliente_no_encontrado');
    }

    let prefijoFinal = clienteActual[0].prefijo_tracking;

    // Si se proporcionó un nuevo prefijo
    if (prefijo_tracking_manual && prefijo_tracking_manual.trim() !== '') {
      const nuevoPrefijoUpper = prefijo_tracking_manual.toUpperCase();

      // Solo validar si cambió
      if (nuevoPrefijoUpper !== clienteActual[0].prefijo_tracking) {
        const validacion = validarFormatoPrefijo(nuevoPrefijoUpper);

        if (!validacion.valido) {
          return renderError(validacion.error);
        }

        // Verificar disponibilidad (excluyendo el cliente actual)
        const [result] = await db.query(
          'SELECT COUNT(*) as count FROM clientes WHERE prefijo_tracking = ? AND id != ? AND eliminado_en IS NULL',
          [nuevoPrefijoUpper, id]
        );

        if (result[0].count > 0) {
          return renderError('El prefijo ya está en uso');
        }

        prefijoFinal = nuevoPrefijoUpper;
      }
    }
    
    // ⬅️ MODIFICADO: Actualizar cliente con prefijo y templates
    const tplIdEdit = parseInt(template_etiqueta_id) || null;
    const guiaTplIdEdit = parseInt(template_guia_id) || null;
    const metodoPagoEdit = ['PUE', 'PPD'].includes(metodo_pago_defecto) ? metodo_pago_defecto : 'PPD';
    await db.query(
      `UPDATE clientes
       SET nombre_empresa = ?, contacto = ?, telefono = ?, email = ?, direccion = ?, prefijo_tracking = ?,
           template_etiqueta_id = ?, template_guia_id = ?, metodo_pago_defecto = ?
       WHERE id = ?`,
      [nombre_empresa, contacto, telefono, email, direccion, prefijoFinal, tplIdEdit, guiaTplIdEdit, metodoPagoEdit, id]
    );
    
    res.redirect(`/clientes/${id}?success=updated`);
    
  } catch (error) {
    console.error('Error al actualizar cliente:', error);
    
    if (error.code === 'ER_DUP_ENTRY' && error.message.includes('prefijo_tracking')) {
      const [clientes] = await db.query('SELECT * FROM clientes WHERE id = ?', [req.params.id]);
      return res.render('clientes/editar', {
        title: 'Editar Cliente',
        user: {
          nombre: req.session.userName,
          email: req.session.userEmail,
          rol: req.session.userRole
        },
        cliente: clientes[0],
        error: 'El prefijo ya está en uso'
      });
    }
    
    const [clientes] = await db.query('SELECT * FROM clientes WHERE id = ?', [req.params.id]);
    res.render('clientes/editar', {
      title: 'Editar Cliente',
      user: {
        nombre: req.session.userName,
        email: req.session.userEmail,
        rol: req.session.userRole
      },
      cliente: clientes[0],
      error: 'Error al actualizar el cliente'
    });
  }
});

// ============================================
// ASIGNAR OPERADORES A CLIENTE (admin/super)
// ============================================
router.post('/:id/asignar-operadores', isAuthenticated, requireAdminOrSuper, async (req, res) => {
  try {
    const { id } = req.params;
    const ids = [].concat(req.body.operador_ids || []).map(Number).filter(Boolean);
    await db.query('DELETE FROM cliente_operadores WHERE cliente_id = ?', [id]);
    if (ids.length > 0) {
      const rows = ids.map(uid => [parseInt(id), uid]);
      await db.query('INSERT INTO cliente_operadores (cliente_id, usuario_id) VALUES ?', [rows]);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error al asignar operadores:', error);
    res.status(500).json({ success: false });
  }
});

// ============================================
// ELIMINAR CLIENTE
// ============================================
router.post('/:id/eliminar', isAuthenticated, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Soft delete — marcar como eliminado sin borrar el registro
    await db.query(
      'UPDATE clientes SET eliminado_en = NOW() WHERE id = ? AND eliminado_en IS NULL',
      [id]
    );
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error al eliminar cliente:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al eliminar el cliente' 
    });
  }
});

// Restaurar cliente eliminado (solo admin)
router.post('/:id/restaurar', isAuthenticated, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.query(
      'UPDATE clientes SET eliminado_en = NULL WHERE id = ?',
      [id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error al restaurar cliente:', error);
    res.status(500).json({ success: false, message: 'Error al restaurar el cliente' });
  }
});

// Toggle activo/inactivo
router.post('/:id/toggle-activo', isAuthenticated, requireAdminOrSuper, async (req, res) => {
  try {
    const { id } = req.params;
    const { activo } = req.body;
    
    await db.query('UPDATE clientes SET activo = ? WHERE id = ?', [activo, id]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    res.json({ success: false, message: error.message });
  }
});

// Eliminar permanentemente (solo admin, desde la página de eliminados)
router.post('/:id/eliminar-permanente', isAuthenticated, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Solo se puede eliminar permanentemente si ya fue soft-deleted
    const [clientes] = await db.query(
      'SELECT id FROM clientes WHERE id = ? AND eliminado_en IS NOT NULL',
      [id]
    );
    
    if (clientes.length === 0) {
      return res.json({ success: false, message: 'El cliente no está en la lista de eliminados' });
    }
    
    // Desvincular envíos antes de borrar (FK constraint)
    await db.query('UPDATE envios SET cliente_id = NULL WHERE cliente_id = ?', [id]);
    await db.query('DELETE FROM clientes WHERE id = ?', [id]);
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error al eliminar permanentemente:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar el cliente' });
  }
});

// ============================================
// TOGGLE HABILITADO (apaga todo, incluido tracking)
// ============================================
router.post('/:id/toggle-habilitado', isAuthenticated, requireAdminOrSuper, async (req, res) => {
  try {
    const { id } = req.params;
    const { habilitado } = req.body;
    await db.query('UPDATE clientes SET habilitado = ? WHERE id = ?', [habilitado, id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error al cambiar habilitado:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar el estado' });
  }
});

// ============================================
// DUPLICAR CLIENTE
// ============================================
router.post('/:id/duplicar', isAuthenticated, requireAdminOrSuper, async (req, res) => {
  try {
    const { id } = req.params;
    const { nuevo_prefijo, nuevo_nombre } = req.body;

    if (!nuevo_prefijo || !nuevo_prefijo.trim()) {
      return res.status(400).json({ success: false, error: 'El nuevo prefijo es requerido' });
    }
    if (!nuevo_nombre || !nuevo_nombre.trim()) {
      return res.status(400).json({ success: false, error: 'El nombre del nuevo cliente es requerido' });
    }

    const prefijoUpper = nuevo_prefijo.trim().toUpperCase();
    const nombreNuevo  = nuevo_nombre.trim();

    // Validar formato
    const validacion = validarFormatoPrefijo(prefijoUpper);
    if (!validacion.valido) {
      return res.status(400).json({ success: false, error: validacion.error });
    }

    // Verificar disponibilidad
    const disponible = await prefijoDisponible(prefijoUpper);
    if (!disponible) {
      return res.status(400).json({ success: false, error: 'El prefijo ya está en uso' });
    }

    // Obtener cliente original
    const [clientes] = await db.query(
      'SELECT * FROM clientes WHERE id = ? AND eliminado_en IS NULL',
      [id]
    );
    if (clientes.length === 0) {
      return res.status(404).json({ success: false, error: 'Cliente no encontrado' });
    }
    const original = clientes[0];

    // Insertar nuevo cliente con nuevo nombre, prefijo y contador en 0
    const [insertResult] = await db.query(
      `INSERT INTO clientes
       (nombre_empresa, contacto, telefono, email, direccion, prefijo_tracking, ultimo_numero_tracking, template_etiqueta_id, template_guia_id, metodo_pago_defecto)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [nombreNuevo, original.contacto, original.telefono, original.email,
       original.direccion, prefijoUpper, original.template_etiqueta_id,
       original.template_guia_id, original.metodo_pago_defecto]
    );
    const nuevoClienteId = insertResult.insertId;

    // Duplicar direcciones activas
    const [direcciones] = await db.query(
      'SELECT * FROM direcciones_cliente WHERE cliente_id = ? AND activa = 1',
      [id]
    );
    for (const dir of direcciones) {
      await db.query(
        `INSERT INTO direcciones_cliente
         (cliente_id, alias, tipo, calle, colonia, ciudad, estado, cp, referencia, es_predeterminada, activa)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [nuevoClienteId, dir.alias, dir.tipo, dir.calle, dir.colonia,
         dir.ciudad, dir.estado, dir.cp, dir.referencia, dir.es_predeterminada]
      );
    }

    console.log(`✅ Cliente duplicado: ${original.nombre_empresa} (id:${id}) → "${nombreNuevo}" id:${nuevoClienteId}, prefijo: ${prefijoUpper}`);
    res.json({ success: true, nuevoClienteId });

  } catch (error) {
    console.error('Error al duplicar cliente:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, error: 'El prefijo ya está en uso' });
    }
    res.status(500).json({ success: false, error: 'Error al duplicar el cliente' });
  }
});

module.exports = router;