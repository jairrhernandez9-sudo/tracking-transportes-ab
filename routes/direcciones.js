const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Middleware de autenticación
function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.redirect('/auth/login');
}

router.use(isAuthenticated);

// ============================================
// API: OBTENER DIRECCIONES DE UN CLIENTE
// ============================================
router.get('/cliente/:clienteId', isAuthenticated, async (req, res) => {
  const { clienteId } = req.params;
  
  try {
    const [direcciones] = await db.query(`
      SELECT * FROM direcciones_cliente 
      WHERE cliente_id = ? AND activa = 1 
      ORDER BY es_predeterminada DESC, alias ASC
    `, [clienteId]);
    
    res.json({ success: true, direcciones });
  } catch (error) {
    console.error('Error al obtener direcciones cliente:', error);
    res.status(500).json({ success: false, message: 'Error al cargar direcciones' });
  }
});

// ============================================
// CREAR NUEVA DIRECCIÓN
// ============================================
router.post('/nueva', async (req, res) => {
  try {
    const {
      cliente_id,
      alias,
      calle,
      colonia,
      ciudad,
      estado,
      cp,
      referencia,
      tipo,
      es_predeterminada
    } = req.body;
    
    // Validar campos obligatorios
    if (!cliente_id || !alias || !calle || !colonia || !ciudad || !estado || !cp) {
      return res.status(400).json({ 
        success: false, 
        error: 'Campos obligatorios faltantes' 
      });
    }
    
    // Si se marca como predeterminada, quitar de las demás del cliente
    if (es_predeterminada === 'on' || es_predeterminada === true) {
      await db.query(
        'UPDATE direcciones_cliente SET es_predeterminada = 0 WHERE cliente_id = ?',
        [cliente_id]
      );
    }
    
    // Insertar nueva dirección
    await db.query(`
      INSERT INTO direcciones_cliente 
      (cliente_id, alias, tipo, calle, colonia, ciudad, estado, cp, referencia, es_predeterminada, activa)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      cliente_id,
      alias,
      tipo || 'destino',
      calle,
      colonia,
      ciudad,
      estado,
      cp,
      referencia || null,
      (es_predeterminada === 'on' || es_predeterminada === true) ? 1 : 0
    ]);
    
    console.log('✅ Dirección de cliente creada:', alias);
    
    // Respuesta JSON
    res.json({ success: true, message: 'Dirección creada' });
    
  } catch (error) {
    console.error('Error al crear dirección:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ 
        success: false, 
        error: 'Ya existe una dirección con ese alias' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Error al crear dirección' 
    });
  }
});

// ============================================
// EDITAR DIRECCIÓN
// ============================================
router.post('/:id/editar', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      alias,
      calle,
      colonia,
      ciudad,
      estado,
      cp,
      referencia,
      tipo,
      es_predeterminada
    } = req.body;
    
    // Validar campos obligatorios
    if (!alias || !calle || !colonia || !ciudad || !estado || !cp) {
      return res.status(400).json({ 
        success: false, 
        error: 'Campos obligatorios faltantes' 
      });
    }
    
    // Obtener cliente_id de la dirección
    const [direccion] = await db.query(
      'SELECT cliente_id FROM direcciones_cliente WHERE id = ?',
      [id]
    );
    
    if (direccion.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Dirección no encontrada' 
      });
    }
    
    const clienteId = direccion[0].cliente_id;
    
    // Si se marca como predeterminada, quitar de las demás
    if (es_predeterminada === 'on' || es_predeterminada === true || es_predeterminada === '1') {
      await db.query(
        'UPDATE direcciones_cliente SET es_predeterminada = 0 WHERE cliente_id = ?',
        [clienteId]
      );
    }
    
    // Actualizar dirección
    await db.query(`
      UPDATE direcciones_cliente 
      SET alias = ?, tipo = ?, calle = ?, colonia = ?, ciudad = ?, 
          estado = ?, cp = ?, referencia = ?, es_predeterminada = ?
      WHERE id = ?
    `, [
      alias,
      tipo || 'destino',
      calle,
      colonia,
      ciudad,
      estado,
      cp,
      referencia || null,
      (es_predeterminada === 'on' || es_predeterminada === true || es_predeterminada === '1') ? 1 : 0,
      id
    ]);
    
    console.log('✅ Dirección actualizada:', id);
    res.json({ success: true, message: 'Dirección actualizada' });
    
  } catch (error) {
    console.error('Error al editar dirección:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al editar dirección' 
    });
  }
});

// ============================================
// ELIMINAR DIRECCIÓN (SOFT DELETE)
// ============================================
router.post('/:id/eliminar', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Obtener cliente_id
    const [direccion] = await db.query(
      'SELECT cliente_id FROM direcciones_cliente WHERE id = ?',
      [id]
    );
    
    if (direccion.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Dirección no encontrada' 
      });
    }
    
    const clienteId = direccion[0].cliente_id;
    
    // Soft delete
    await db.query(
      'UPDATE direcciones_cliente SET activa = 0 WHERE id = ?',
      [id]
    );
    
    // Si era predeterminada, marcar otra como predeterminada
    const [predeterminada] = await db.query(
      'SELECT id FROM direcciones_cliente WHERE cliente_id = ? AND activa = 1 ORDER BY id ASC LIMIT 1',
      [clienteId]
    );
    
    if (predeterminada.length > 0) {
      await db.query(
        'UPDATE direcciones_cliente SET es_predeterminada = 1 WHERE id = ?',
        [predeterminada[0].id]
      );
    }
    
    console.log('✅ Dirección eliminada:', id);
    res.json({ success: true, message: 'Dirección eliminada' });
    
  } catch (error) {
    console.error('Error al eliminar dirección:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al eliminar dirección' 
    });
  }
});

// ============================================
// MARCAR COMO PREDETERMINADA
// ============================================
router.post('/:id/predeterminada', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Obtener cliente_id
    const [direccion] = await db.query(
      'SELECT cliente_id FROM direcciones_cliente WHERE id = ?',
      [id]
    );
    
    if (direccion.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Dirección no encontrada' 
      });
    }
    
    const clienteId = direccion[0].cliente_id;
    
    // Quitar predeterminada de todas
    await db.query(
      'UPDATE direcciones_cliente SET es_predeterminada = 0 WHERE cliente_id = ?',
      [clienteId]
    );
    
    // Marcar esta como predeterminada
    await db.query(
      'UPDATE direcciones_cliente SET es_predeterminada = 1 WHERE id = ?',
      [id]
    );
    
    console.log('✅ Dirección marcada como predeterminada:', id);
    res.json({ success: true, message: 'Dirección predeterminada actualizada' });
    
  } catch (error) {
    console.error('Error al marcar predeterminada:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al marcar predeterminada' 
    });
  }
});



module.exports = router;