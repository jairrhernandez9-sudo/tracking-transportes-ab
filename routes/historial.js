const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { isAuthenticated } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');

// ============================================
// HISTORIAL DE ACTIVIDAD DEL SISTEMA
// ============================================
router.get('/actividad', isAuthenticated, async (req, res) => {
  if (req.session.userEmail !== 'jose.cordoba@transportesab.com') {
    return res.status(403).send('No tienes acceso a esta página.');
  }
  try {
    const POR_PAGINA = 50;
    const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
    const offset  = (pagina - 1) * POR_PAGINA;

    const { accion, entidad, usuario_id, fecha_desde, fecha_hasta, q } = req.query;

    let where = ['1=1'];
    let params = [];

    if (accion)      { where.push('a.accion = ?');       params.push(accion); }
    if (entidad)     { where.push('a.entidad = ?');      params.push(entidad); }
    if (usuario_id)  { where.push('a.usuario_id = ?');   params.push(parseInt(usuario_id)); }
    if (fecha_desde) { where.push('DATE(a.fecha) >= ?'); params.push(fecha_desde); }
    if (fecha_hasta) { where.push('DATE(a.fecha) <= ?'); params.push(fecha_hasta); }
    if (q)           { where.push('(a.descripcion LIKE ? OR a.usuario_nombre LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }

    const whereStr = where.join(' AND ');

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM actividad_log a WHERE ${whereStr}`, params
    );

    const [registros] = await db.query(
      `SELECT a.*, DATE_FORMAT(CONVERT_TZ(a.fecha, '+00:00', 'America/Mexico_City'), '%d/%m/%Y %H:%i:%s') as fecha_fmt
       FROM actividad_log a
       WHERE ${whereStr}
       ORDER BY a.fecha DESC
       LIMIT ? OFFSET ?`,
      [...params, POR_PAGINA, offset]
    );

    // Para el filtro de usuarios únicos
    const [usuariosLog] = await db.query(
      `SELECT DISTINCT usuario_id, usuario_nombre FROM actividad_log
       WHERE usuario_id IS NOT NULL ORDER BY usuario_nombre`
    );

    const totalPaginas = Math.ceil(total / POR_PAGINA);

    res.render('historial/actividad', {
      title: 'Historial de Actividad',
      registros,
      usuariosLog,
      filtros: { accion, entidad, usuario_id, fecha_desde, fecha_hasta, q },
      pagination: { pagina, totalPaginas, total },
      user: {
        id: req.session.userId,
        nombre: req.session.userName,
        email: req.session.userEmail,
        rol: req.session.userRole
      }
    });
  } catch (error) {
    console.error('Error al cargar historial de actividad:', error);
    res.status(500).send('Error al cargar el historial de actividad');
  }
});

// ============================================
// EDITAR ESTADO DEL HISTORIAL
// ============================================
router.put('/:id/editar', isAuthenticated, async (req, res) => {
  try {
    const estadoId = req.params.id;

    if (!['admin', 'superusuario', 'operador'].includes(req.session.userRole)) {
      return res.status(403).json({ success: false, message: 'No tienes permisos para editar estados' });
    }

    const [estados] = await db.query('SELECT * FROM historial_estados WHERE id = ?', [estadoId]);
    if (estados.length === 0) {
      return res.status(404).json({ success: false, message: 'Estado no encontrado' });
    }

    const { estado, ubicacion, comentarios, fecha_hora } = req.body;

    // Sólo actualizar fecha_hora si se envió explícitamente (no vacío)
    // El valor viene en hora México (America/Mexico_City), lo pasamos directamente a MySQL DATETIME
    const usarFecha = fecha_hora && fecha_hora.trim() !== '';

    await db.query(
      `UPDATE historial_estados
       SET estado = ?, ubicacion = ?, comentarios = ?
       ${usarFecha ? ', fecha_hora = CONVERT_TZ(?, \'America/Mexico_City\', \'UTC\')' : ''}
       WHERE id = ?`,
      usarFecha
        ? [estado, ubicacion || null, comentarios || null, fecha_hora, estadoId]
        : [estado, ubicacion || null, comentarios || null, estadoId]
    );

    // Actualizar estado_actual del envío al más reciente
    const [ultimoEstado] = await db.query(
      `SELECT estado FROM historial_estados WHERE envio_id = ? ORDER BY fecha_hora DESC LIMIT 1`,
      [estados[0].envio_id]
    );
    if (ultimoEstado.length > 0) {
      await db.query('UPDATE envios SET estado_actual = ? WHERE id = ?', [ultimoEstado[0].estado, estados[0].envio_id]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error al editar estado:', error);
    res.status(500).json({ success: false, message: 'Error al editar el estado' });
  }
});

// ============================================
// ELIMINAR ESTADO DEL HISTORIAL
// ============================================
router.delete('/:id/eliminar', isAuthenticated, async (req, res) => {
  try {
    const estadoId = req.params.id;

    // Solo admin y superusuario pueden eliminar estados
    if (!['admin', 'superusuario'].includes(req.session.userRole)) {
      return res.status(403).json({ success: false, message: 'No tienes permisos para eliminar estados' });
    }
    
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

// ============================================
// ELIMINAR FOTO INDIVIDUAL DE HISTORIAL
// ============================================
router.delete('/foto/:id', isAuthenticated, async (req, res) => {
  try {
    const fotoId = req.params.id;

    if (!['admin', 'superusuario'].includes(req.session.userRole)) {
      return res.status(403).json({ success: false, message: 'No tienes permisos para eliminar fotos' });
    }

    const [fotos] = await db.query('SELECT * FROM fotos_evidencia WHERE id = ?', [fotoId]);
    if (fotos.length === 0) {
      return res.status(404).json({ success: false, message: 'Foto no encontrada' });
    }

    const foto = fotos[0];

    // Eliminar de la BD
    await db.query('DELETE FROM fotos_evidencia WHERE id = ?', [fotoId]);

    // Eliminar archivo del disco si está en /uploads/
    if (foto.url_foto && foto.url_foto.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '..', 'public', foto.url_foto);
      fs.unlink(filePath, err => {
        if (err) console.warn('No se pudo eliminar archivo:', filePath, err.message);
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar foto:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar la foto' });
  }
});

module.exports = router;