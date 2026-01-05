const express = require('express');
const router = express.Router();
const db = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Middleware de autenticación
function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.redirect('/auth/login');
}

// Configuración de Multer para subir fotos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'public/images/evidencias';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'evidencia-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máximo
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = /image\/(jpeg|jpg|png|gif|webp)|application\/pdf/.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (JPEG, PNG, GIF, WEBP) y PDF'));
    }
  }
});

// ==================== RUTAS ====================

// Lista de envíos con filtros
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { buscar, estado, orderBy } = req.query;
    
    let query = `
      SELECT 
        e.*,
        c.nombre_empresa,
        c.contacto,
        u.nombre as creador_nombre
      FROM envios e
      LEFT JOIN clientes c ON e.cliente_id = c.id
      LEFT JOIN usuarios u ON e.usuario_creador_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    
    // Filtro de búsqueda
    if (buscar) {
      query += ` AND (
        e.numero_tracking LIKE ? OR 
        c.nombre_empresa LIKE ? OR 
        e.origen LIKE ? OR 
        e.destino LIKE ?
      )`;
      const searchTerm = `%${buscar}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    // Filtro de estado
    if (estado && estado !== 'todos') {
      query += ` AND e.estado_actual = ?`;
      params.push(estado);
    }
    
    // Ordenamiento
    const order = orderBy === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY e.fecha_creacion ${order}`;
    
    const [envios] = await db.query(query, params);
    
    res.render('envios/lista', {
      title: 'Lista de Envíos',
      user: {
        id: req.session.userId,
        nombre: req.session.userName,
        email: req.session.userEmail,
        rol: req.session.userRole
      },
      envios,
      filtros: { buscar, estado: estado || 'todos', orderBy }
    });
  } catch (error) {
    console.error('Error al obtener envíos:', error);
    res.status(500).send('Error al cargar los envíos');
  }
});

// Detalle de un envío
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { success } = req.query;
    
    // Obtener información del envío con datos del cliente
    const [envios] = await db.query(`
      SELECT 
        e.*,
        c.nombre_empresa,
        c.contacto,
        c.telefono,
        c.email as cliente_email,
        u.nombre as creador_nombre
      FROM envios e
      LEFT JOIN clientes c ON e.cliente_id = c.id
      LEFT JOIN usuarios u ON e.usuario_creador_id = u.id
      WHERE e.id = ?
    `, [id]);
    
    if (envios.length === 0) {
      return res.status(404).send('Envío no encontrado');
    }
    
    const envio = envios[0];
    
    // Obtener historial de estados con fotos
    const [historial] = await db.query(`
      SELECT 
        he.*,
        u.nombre as usuario_nombre
      FROM historial_estados he
      LEFT JOIN usuarios u ON he.usuario_id = u.id
      WHERE he.envio_id = ?
      ORDER BY he.fecha_hora DESC
    `, [id]);
    
    // Obtener fotos de evidencia para cada estado
    for (let estado of historial) {
      const [fotos] = await db.query(
        'SELECT * FROM fotos_evidencia WHERE historial_estado_id = ?',
        [estado.id]
      );
      estado.fotos = fotos;
    }
    
    res.render('envios/detalle', {
      title: 'Detalle del Envío',
      user: {
        id: req.session.userId,
        nombre: req.session.userName,
        email: req.session.userEmail,
        rol: req.session.userRole
      },
      envio,
      historial,
      success
    });
  } catch (error) {
    console.error('Error al obtener detalle del envío:', error);
    res.status(500).send('Error al cargar el detalle');
  }
});

// Formulario crear nuevo envío
router.get('/nuevo/formulario', isAuthenticated, async (req, res) => {
  try {
    // ✅ SOLO CLIENTES ACTIVOS
    const [clientes] = await db.query(
      'SELECT * FROM clientes WHERE activo = 1 ORDER BY nombre_empresa'
    );
    
    res.render('envios/nuevo', {
      title: 'Crear Nuevo Envío',
      user: {
        id: req.session.userId,
        nombre: req.session.userName,
        email: req.session.userEmail,
        rol: req.session.userRole
      },
      clientes,
      error: null
    });
  } catch (error) {
    console.error('Error al cargar formulario:', error);
    res.status(500).send('Error al cargar el formulario');
  }
});

// Crear nuevo envío (POST)
router.post('/nuevo', isAuthenticated, async (req, res) => {
  try {
    const { cliente_id, descripcion, peso, fecha_estimada_entrega, origen, destino } = req.body;
    
    if (!cliente_id || !origen || !destino) {
      // ✅ SOLO CLIENTES ACTIVOS
      const [clientes] = await db.query(
        'SELECT * FROM clientes WHERE activo = 1 ORDER BY nombre_empresa'
      );
      return res.render('envios/nuevo', {
        title: 'Crear Nuevo Envío',
        user: {
          id: req.session.userId,
          nombre: req.session.userName,
          email: req.session.userEmail,
          rol: req.session.userRole
        },
        clientes,
        error: 'Cliente, origen y destino son obligatorios'
      });
    }
    
    // Generar número de tracking automático
    const year = new Date().getFullYear();
    const [lastTracking] = await db.query(
      `SELECT numero_tracking FROM envios 
       WHERE numero_tracking LIKE ? 
       ORDER BY id DESC LIMIT 1`,
      [`TRK-${year}-%`]
    );
    
    let nextNumber = 1;
    if (lastTracking.length > 0) {
      const lastNumber = parseInt(lastTracking[0].numero_tracking.split('-')[2]);
      nextNumber = lastNumber + 1;
    }
    
    const numeroTracking = `TRK-${year}-${String(nextNumber).padStart(3, '0')}`;
    
    // Insertar envío
    const [result] = await db.query(
      `INSERT INTO envios (numero_tracking, cliente_id, descripcion, peso, fecha_estimada_entrega, origen, destino, usuario_creador_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [numeroTracking, cliente_id, descripcion, peso || null, fecha_estimada_entrega || null, origen, destino, req.session.userId]
    );
    
    // Crear estado inicial en historial
    await db.query(
      `INSERT INTO historial_estados (envio_id, estado, ubicacion, comentarios, usuario_id)
       VALUES (?, 'creado', ?, 'Envío creado en el sistema', ?)`,
      [result.insertId, origen, req.session.userId]
    );
    
    console.log('✅ Envío creado:', numeroTracking);
    res.redirect(`/envios/${result.insertId}?success=created`);
    
  } catch (error) {
    console.error('Error al crear envío:', error);
    // ✅ SOLO CLIENTES ACTIVOS
    const [clientes] = await db.query(
      'SELECT * FROM clientes WHERE activo = 1 ORDER BY nombre_empresa'
    );
    res.render('envios/nuevo', {
      title: 'Crear Nuevo Envío',
      user: {
        id: req.session.userId,
        nombre: req.session.userName,
        email: req.session.userEmail,
        rol: req.session.userRole
      },
      clientes,
      error: 'Error al crear el envío: ' + error.message
    });
  }
});

// Formulario editar envío
router.get('/:id/editar', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [envios] = await db.query('SELECT * FROM envios WHERE id = ?', [id]);
    
    if (envios.length === 0) {
      return res.status(404).send('Envío no encontrado');
    }
    
    // ✅ SOLO CLIENTES ACTIVOS
    const [clientes] = await db.query(
      'SELECT * FROM clientes WHERE activo = 1 ORDER BY nombre_empresa'
    );
    
    res.render('envios/editar', {
      title: 'Editar Envío',
      user: {
        id: req.session.userId,
        nombre: req.session.userName,
        email: req.session.userEmail,
        rol: req.session.userRole
      },
      envio: envios[0],
      clientes,
      error: null
    });
  } catch (error) {
    console.error('Error al cargar formulario de edición:', error);
    res.status(500).send('Error al cargar el formulario');
  }
});

// Actualizar envío (POST)
router.post('/:id/editar', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { cliente_id, descripcion, peso, fecha_estimada_entrega, origen, destino } = req.body;
    
    if (!cliente_id || !origen || !destino) {
      const [envios] = await db.query('SELECT * FROM envios WHERE id = ?', [id]);
      // ✅ SOLO CLIENTES ACTIVOS
      const [clientes] = await db.query(
        'SELECT * FROM clientes WHERE activo = 1 ORDER BY nombre_empresa'
      );
      
      return res.render('envios/editar', {
        title: 'Editar Envío',
        user: {
          id: req.session.userId,
          nombre: req.session.userName,
          email: req.session.userEmail,
          rol: req.session.userRole
        },
        envio: envios[0],
        clientes,
        error: 'Cliente, origen y destino son obligatorios'
      });
    }
    
    await db.query(
      `UPDATE envios 
       SET cliente_id = ?, descripcion = ?, peso = ?, fecha_estimada_entrega = ?, origen = ?, destino = ?
       WHERE id = ?`,
      [cliente_id, descripcion, peso || null, fecha_estimada_entrega || null, origen, destino, id]
    );
    
    console.log('✅ Envío actualizado:', id);
    res.redirect(`/envios/${id}?success=updated`);
    
  } catch (error) {
    console.error('Error al actualizar envío:', error);
    const [envios] = await db.query('SELECT * FROM envios WHERE id = ?', [req.params.id]);
    // ✅ SOLO CLIENTES ACTIVOS
    const [clientes] = await db.query(
      'SELECT * FROM clientes WHERE activo = 1 ORDER BY nombre_empresa'
    );
    
    res.render('envios/editar', {
      title: 'Editar Envío',
      user: {
        id: req.session.userId,
        nombre: req.session.userName,
        email: req.session.userEmail,
        rol: req.session.userRole
      },
      envio: envios[0],
      clientes,
      error: 'Error al actualizar el envío: ' + error.message
    });
  }
});

// Actualizar estado de envío (POST)
router.post('/:id/actualizar-estado', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { nuevo_estado, ubicacion, comentarios } = req.body;
    
    if (!nuevo_estado || !ubicacion) {
      return res.status(400).json({ success: false, message: 'Estado y ubicación son obligatorios' });
    }
    
    // VERIFICAR ESTADO ACTUAL
    const [envios] = await db.query('SELECT estado_actual FROM envios WHERE id = ?', [id]);
    
    if (envios.length === 0) {
      return res.status(404).json({ success: false, message: 'Envío no encontrado' });
    }
    
    const estadoActual = envios[0].estado_actual;
    
    // BLOQUEAR SI ESTÁ CANCELADO
    if (estadoActual === 'cancelado') {
      return res.status(400).json({ 
        success: false, 
        message: 'No se puede actualizar un envío cancelado' 
      });
    }
    
    // BLOQUEAR SI ESTÁ ENTREGADO
    if (estadoActual === 'entregado') {
      return res.status(400).json({ 
        success: false, 
        message: 'No se puede actualizar un envío que ya fue entregado' 
      });
    }
    
    // Actualizar estado actual del envío
    await db.query(
      'UPDATE envios SET estado_actual = ? WHERE id = ?',
      [nuevo_estado, id]
    );
    
    // Insertar en historial
    const [result] = await db.query(
      `INSERT INTO historial_estados (envio_id, estado, ubicacion, comentarios, usuario_id)
       VALUES (?, ?, ?, ?, ?)`,
      [id, nuevo_estado, ubicacion, comentarios, req.session.userId]
    );
    
    console.log('✅ Estado actualizado:', nuevo_estado);
    res.json({ success: true, historial_id: result.insertId });
    
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar el estado' });
  }
});

// Subir múltiples fotos de evidencia
router.post('/:id/subir-fotos', isAuthenticated, upload.array('fotos', 5), async (req, res) => {
  try {
    const { id } = req.params;
    const { historial_estado_id, comentario } = req.body;
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No se subieron archivos' 
      });
    }
    
    console.log('📸 Archivos recibidos:', req.files.length);
    
    let uploadedCount = 0;
    
    // Guardar cada archivo en la base de datos
    for (const file of req.files) {
      const urlFoto = `/images/evidencias/${file.filename}`;
      
      await db.query(
        `INSERT INTO fotos_evidencia (historial_estado_id, url_foto, descripcion)
         VALUES (?, ?, ?)`,
        [historial_estado_id, urlFoto, comentario || '']
      );
      
      uploadedCount++;
      console.log(`✅ Foto ${uploadedCount} guardada:`, urlFoto);
    }
    
    console.log(`✅ Total ${uploadedCount} foto(s) subida(s)`);
    
    res.json({ 
      success: true, 
      uploaded: uploadedCount,
      message: `${uploadedCount} archivo(s) subido(s) exitosamente`
    });
    
  } catch (error) {
    console.error('❌ Error al subir fotos:', error);
    
    // Si hay archivos temporales, eliminarlos
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Error al subir los archivos: ' + error.message 
    });
  }
});

// Cancelar envío
router.post('/:id/cancelar', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo, comentarios } = req.body;
    
    // Solo admin puede cancelar
    if (req.session.userRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'No tienes permisos para cancelar envíos' });
    }
    
    // Verificar que el envío existe
    const [envios] = await db.query('SELECT * FROM envios WHERE id = ?', [id]);
    if (envios.length === 0) {
      return res.status(404).json({ success: false, message: 'Envío no encontrado' });
    }
    
    const envio = envios[0];
    
    // Verificar que no esté ya cancelado
    if (envio.estado_actual === 'cancelado') {
      return res.status(400).json({ success: false, message: 'El envío ya está cancelado' });
    }
    
    // Verificar que no esté entregado
    if (envio.estado_actual === 'entregado') {
      return res.status(400).json({ success: false, message: 'No se puede cancelar un envío ya entregado' });
    }
    
    // Actualizar estado a cancelado
    await db.query(
      'UPDATE envios SET estado_actual = ? WHERE id = ?',
      ['cancelado', id]
    );
    
    // Construir comentario completo
    const motivosMap = {
      'solicitud_cliente': 'Solicitud del cliente',
      'direccion_incorrecta': 'Dirección incorrecta',
      'pago_rechazado': 'Pago rechazado',
      'producto_no_disponible': 'Producto no disponible',
      'duplicado': 'Envío duplicado',
      'otro': 'Otro motivo'
    };
    
    const motivoTexto = motivosMap[motivo] || motivo;
    const comentarioCompleto = `Cancelado: ${motivoTexto}. ${comentarios || ''}`.trim();
    
    // Insertar en historial
    await db.query(
      `INSERT INTO historial_estados (envio_id, estado, ubicacion, comentarios, usuario_id)
       VALUES (?, 'cancelado', ?, ?, ?)`,
      [id, envio.origen || 'Sistema', comentarioCompleto, req.session.userId]
    );
    
    console.log('✅ Envío cancelado:', id);
    res.json({ success: true, message: 'Envío cancelado correctamente' });
    
  } catch (error) {
    console.error('Error al cancelar envío:', error);
    res.status(500).json({ success: false, message: 'Error al cancelar el envío' });
  }
});

// Eliminar envío físicamente (solo admin, solo para pruebas)
router.post('/:id/eliminar', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Solo admin puede eliminar
    if (req.session.userRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'No tienes permisos para eliminar envíos' });
    }
    
    // Eliminar fotos asociadas
    const [fotos] = await db.query(`
      SELECT fe.url_foto 
      FROM fotos_evidencia fe
      INNER JOIN historial_estados he ON fe.historial_estado_id = he.id
      WHERE he.envio_id = ?
    `, [id]);
    
    fotos.forEach(foto => {
      const filePath = path.join(__dirname, '..', 'public', foto.url_foto);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
    
    // Eliminar de base de datos (CASCADE debería encargarse del resto)
    await db.query('DELETE FROM envios WHERE id = ?', [id]);
    
    console.log('✅ Envío eliminado:', id);
    res.json({ success: true, message: 'Envío eliminado correctamente' });
    
  } catch (error) {
    console.error('Error al eliminar envío:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar el envío' });
  }
});

// Generar etiqueta térmica (4x6 pulgadas)
router.get('/:id/etiqueta', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [envios] = await db.query(`
      SELECT 
        e.*,
        c.nombre_empresa,
        c.contacto,
        c.telefono,
        c.direccion as cliente_direccion
      FROM envios e
      LEFT JOIN clientes c ON e.cliente_id = c.id
      WHERE e.id = ?
    `, [id]);
    
    if (envios.length === 0) {
      return res.status(404).send('Envío no encontrado');
    }
    
    res.render('envios/etiqueta', {
      title: 'Etiqueta de Envío',
      envio: envios[0]
    });
  } catch (error) {
    console.error('Error al generar etiqueta:', error);
    res.status(500).send('Error al generar la etiqueta');
  }
});

module.exports = router;