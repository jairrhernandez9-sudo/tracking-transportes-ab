const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { isAuthenticated } = require('../middleware/auth');

// ============================================
// ELIMINAR ESTADO DEL HISTORIAL
// ============================================
router.delete('/:id/eliminar', isAuthenticated, async (req, res) => {
  try {
    const estadoId = req.params.id;
    
    // Verificar que el estado existe
    const [estados] = await db.query(
      'SELECT * FROM historial_estados WHERE id = ?',
      [estadoId]
    );
    
    if (estados.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Estado no encontrado'
      });
    }
    
    const estado = estados[0];
    
    // OPCIONAL: No permitir eliminar el estado "entregado"
    if (estado.estado === 'entregado') {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar el estado "entregado"'
      });
    }
    
    // ============================================
    // COMENTADO: La tabla fotos_historial no existe
    // Si necesitas esta funcionalidad, crea la tabla primero
    // ============================================
    // await db.query(
    //   'DELETE FROM fotos_historial WHERE historial_estado_id = ?',
    //   [estadoId]
    // );
    
    // Eliminar el estado
    await db.query(
      'DELETE FROM historial_estados WHERE id = ?',
      [estadoId]
    );
    
    // Actualizar el estado del envío al anterior
    const [ultimoEstado] = await db.query(
      `SELECT estado 
       FROM historial_estados 
       WHERE envio_id = ? 
       ORDER BY fecha_hora DESC 
       LIMIT 1`,
      [estado.envio_id]
    );
    
    if (ultimoEstado.length > 0) {
      await db.query(
        'UPDATE envios SET estado_actual = ? WHERE id = ?',
        [ultimoEstado[0].estado, estado.envio_id]
      );
    }
    
    res.json({
      success: true,
      message: 'Estado eliminado correctamente'
    });
    
  } catch (error) {
    console.error('Error al eliminar estado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el estado'
    });
  }
});

module.exports = router;