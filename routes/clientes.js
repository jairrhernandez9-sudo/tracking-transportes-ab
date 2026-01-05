const { requireAdmin, requireAdminOrOperator } = require('../middleware/roles');
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { isAuthenticated } = require('../middleware/auth');

// ============================================
// LISTADO DE CLIENTES
// ============================================
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { buscar, orderBy } = req.query;
    
    let query = 'SELECT * FROM clientes WHERE 1=1';
    const params = [];
    
    // Filtro de búsqueda
    if (buscar) {
      query += ` AND (nombre_empresa LIKE ? OR contacto LIKE ? OR email LIKE ? OR telefono LIKE ?)`;
      const searchTerm = `%${buscar}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    // Ordenamiento
    const order = orderBy === 'antiguo' ? 'ASC' : 'DESC';
    query += ` ORDER BY fecha_creacion ${order}`;
    
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
router.get('/nuevo', isAuthenticated, (req, res) => {
  res.render('clientes/nuevo', {
    title: 'Nuevo Cliente',
    user: {
      nombre: req.session.userName,
      email: req.session.userEmail,
      rol: req.session.userRole
    },
    error: null
  });
});

// ============================================
// CREAR CLIENTE (POST)
// ============================================
router.post('/nuevo', isAuthenticated, async (req, res) => {
  try {
    const { nombre_empresa, contacto, telefono, email, direccion } = req.body;
    
    // Validar campos requeridos
    if (!nombre_empresa || !email) {
      return res.render('clientes/nuevo', {
        title: 'Nuevo Cliente',
        user: {
          nombre: req.session.userName,
          email: req.session.userEmail,
          rol: req.session.userRole
        },
        error: 'Nombre de empresa y email son obligatorios'
      });
    }
    
    // Verificar si el email ya existe
    const [existente] = await db.query(
      'SELECT id FROM clientes WHERE email = ?',
      [email]
    );
    
    if (existente.length > 0) {
      return res.render('clientes/nuevo', {
        title: 'Nuevo Cliente',
        user: {
          nombre: req.session.userName,
          email: req.session.userEmail,
          rol: req.session.userRole
        },
        error: 'Ya existe un cliente con ese email'
      });
    }
    
    // Insertar cliente
    await db.query(
      `INSERT INTO clientes (nombre_empresa, contacto, telefono, email, direccion)
       VALUES (?, ?, ?, ?, ?)`,
      [nombre_empresa, contacto, telefono, email, direccion]
    );
    
    res.redirect('/clientes?success=created');
    
  } catch (error) {
    console.error('Error al crear cliente:', error);
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
      `SELECT * FROM envios 
       WHERE cliente_id = ? 
       ORDER BY fecha_creacion DESC 
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
    
    res.render('clientes/detalle', {
      title: cliente.nombre_empresa,
      user: {
        nombre: req.session.userName,
        email: req.session.userEmail,
        rol: req.session.userRole
      },
      cliente,
      envios,
      stats: stats[0]
    });
    
  } catch (error) {
    console.error('Error al cargar detalle:', error);
    res.status(500).send('Error al cargar el detalle del cliente');
  }
});

// ============================================
// EDITAR CLIENTE (GET)
// ============================================
router.get('/:id/editar', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [clientes] = await db.query('SELECT * FROM clientes WHERE id = ?', [id]);
    
    if (clientes.length === 0) {
      return res.status(404).send('Cliente no encontrado');
    }
    
    res.render('clientes/editar', {
      title: 'Editar Cliente',
      user: {
        nombre: req.session.userName,
        email: req.session.userEmail,
        rol: req.session.userRole
      },
      cliente: clientes[0],
      error: null
    });
    
  } catch (error) {
    console.error('Error al cargar formulario:', error);
    res.status(500).send('Error al cargar el formulario');
  }
});

// ============================================
// EDITAR CLIENTE (POST)
// ============================================
router.post('/:id/editar', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre_empresa, contacto, telefono, email, direccion } = req.body;
    
    // Validar campos requeridos
    if (!nombre_empresa || !email) {
      const [clientes] = await db.query('SELECT * FROM clientes WHERE id = ?', [id]);
      return res.render('clientes/editar', {
        title: 'Editar Cliente',
        user: {
          nombre: req.session.userName,
          email: req.session.userEmail,
          rol: req.session.userRole
        },
        cliente: clientes[0],
        error: 'Nombre de empresa y email son obligatorios'
      });
    }
    
    // Verificar si el email ya existe (excluyendo el cliente actual)
    const [existente] = await db.query(
      'SELECT id FROM clientes WHERE email = ? AND id != ?',
      [email, id]
    );
    
    if (existente.length > 0) {
      const [clientes] = await db.query('SELECT * FROM clientes WHERE id = ?', [id]);
      return res.render('clientes/editar', {
        title: 'Editar Cliente',
        user: {
          nombre: req.session.userName,
          email: req.session.userEmail,
          rol: req.session.userRole
        },
        cliente: clientes[0],
        error: 'Ya existe otro cliente con ese email'
      });
    }
    
    // Actualizar cliente
    await db.query(
      `UPDATE clientes 
       SET nombre_empresa = ?, contacto = ?, telefono = ?, email = ?, direccion = ?
       WHERE id = ?`,
      [nombre_empresa, contacto, telefono, email, direccion, id]
    );
    
    res.redirect(`/clientes/${id}?success=updated`);
    
  } catch (error) {
    console.error('Error al actualizar cliente:', error);
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
// ELIMINAR CLIENTE
// ============================================
router.post('/:id/eliminar', isAuthenticated, requireAdmin, async (req, res) => {  try {
    const { id } = req.params;
    
    // Verificar si tiene envíos asociados
    const [envios] = await db.query(
      'SELECT COUNT(*) as total FROM envios WHERE cliente_id = ?',
      [id]
    );
    
    if (envios[0].total > 0) {
      return res.json({ 
        success: false, 
        message: `No se puede eliminar. El cliente tiene ${envios[0].total} envío(s) asociado(s).` 
      });
    }
    
    // Eliminar cliente
    await db.query('DELETE FROM clientes WHERE id = ?', [id]);
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error al eliminar cliente:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al eliminar el cliente' 
    });
  }
});

// Toggle activo/inactivo
router.post('/:id/toggle-activo', isAuthenticated, async (req, res) => {
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

module.exports = router;