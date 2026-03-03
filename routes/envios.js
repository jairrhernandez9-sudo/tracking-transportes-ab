const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { generarSiguienteTracking } = require('../utils/tracking-utils'); 
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ============================================
// FUNCIÓN HELPER: Construir dirección completa
// ============================================
function construirDireccionCompleta(calle, colonia, ciudad, estado, cp, referencia = '') {
  const partes = [];
  
  if (calle && calle.trim()) partes.push(calle.trim());
  if (colonia && colonia.trim()) partes.push(colonia.trim());
  if (ciudad && ciudad.trim()) partes.push(ciudad.trim());
  if (estado && estado.trim()) partes.push(estado.trim());
  if (cp && cp.trim()) partes.push(cp.trim());
  
  let direccion = partes.join(', ');
  
  // Agregar referencia si existe
  if (referencia && referencia.trim()) {
    direccion += ` (${referencia.trim()})`;
  }
  
  return direccion;
}

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

// Lista de envíos con filtros y paginación
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { buscar, estado, orderBy } = req.query;
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 25;

    let whereClause = ' WHERE 1=1';
    const params = [];

    if (buscar) {
      whereClause += ` AND (
        e.numero_tracking LIKE ? OR
        e.referencia_cliente LIKE ? OR
        c.nombre_empresa LIKE ? OR
        e.cliente_nombre LIKE ? OR
        e.origen LIKE ? OR
        e.destino LIKE ?
      )`;
      const searchTerm = `%${buscar}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (estado && estado !== 'todos') {
      whereClause += ` AND e.estado_actual = ?`;
      params.push(estado);
    }

    const [countResult] = await db.query(
      `SELECT COUNT(*) as total
       FROM envios e
       LEFT JOIN clientes c ON e.cliente_id = c.id
       ${whereClause}`,
      params
    );
    const totalEnvios = countResult[0].total;
    const totalPages  = Math.ceil(totalEnvios / limit) || 1;
    const currentPage = Math.min(page, totalPages);
    const offset      = (currentPage - 1) * limit;

    const order = orderBy === 'asc' ? 'ASC' : 'DESC';
    const [envios] = await db.query(
      `SELECT
        e.*,
        COALESCE(c.nombre_empresa, e.cliente_nombre, 'Sin cliente') as nombre_empresa,
        c.contacto,
        u.nombre as creador_nombre
       FROM envios e
       LEFT JOIN clientes c ON e.cliente_id = c.id
       LEFT JOIN usuarios u ON e.usuario_creador_id = u.id
       ${whereClause}
       ORDER BY e.fecha_creacion ${order}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.render('envios/lista', {
      title: 'Lista de Envíos',
      user: {
        id: req.session.userId,
        nombre: req.session.userName,
        email: req.session.userEmail,
        rol: req.session.userRole
      },
      envios,
      filtros: { buscar, estado: estado || 'todos', orderBy },
      pagination: { page: currentPage, totalPages, totalEnvios, limit }
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
        COALESCE(c.nombre_empresa, e.cliente_nombre, 'Sin cliente') as nombre_empresa,
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
    
    const [items] = await db.query(
      'SELECT * FROM envio_items WHERE envio_id = ? ORDER BY id ASC', [id]
    );

    // Guías parciales relacionadas
    let guiaOrigen = null;
    let guiasRelacionadas = [];
    if (envio.envio_relacionado_id) {
      const [origenRows] = await db.query('SELECT * FROM envios WHERE id = ?', [envio.envio_relacionado_id]);
      guiaOrigen = origenRows[0] || null;
    }
    const [relacionadas] = await db.query(
      'SELECT * FROM envios WHERE envio_relacionado_id = ? ORDER BY numero_parte ASC, fecha_creacion ASC',
      [id]
    );
    guiasRelacionadas = relacionadas;

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
      items,
      guiaOrigen,
      guiasRelacionadas,
      success
    });
  } catch (error) {
    console.error('Error al obtener detalle del envío:', error);
    res.status(500).send('Error al cargar el detalle');
  }
});

// Guía Almex del envío (carta porte para imprimir/descargar)
router.get('/:id/guia-almex', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;

    const [envios] = await db.query(`
      SELECT e.*,
        COALESCE(c.nombre_empresa, e.cliente_nombre, 'Sin cliente') as nombre_empresa,
        c.contacto,
        c.telefono,
        c.email as cliente_email,
        c.direccion as cliente_direccion
      FROM envios e
      LEFT JOIN clientes c ON e.cliente_id = c.id
      WHERE e.id = ?
    `, [id]);

    if (envios.length === 0) return res.status(404).send('Envío no encontrado');

    const envio = envios[0];

    const [items] = await db.query(
      'SELECT * FROM envio_items WHERE envio_id = ? ORDER BY id ASC', [id]
    );

    const [configs] = await db.query(
      "SELECT clave, valor FROM configuracion_sistema WHERE clave IN ('empresa_nombre','empresa_rfc','empresa_telefono','empresa_telefono_adicional','empresa_direccion','empresa_logo_url')"
    );
    const config = {};
    configs.forEach(c => { config[c.clave] = c.valor; });

    // Buscar alias de la dirección de origen en direcciones_empresa
    let origenAlias = null;
    if (envio.origen_calle && envio.origen_ciudad) {
      const [origenRows] = await db.query(
        `SELECT alias FROM direcciones_empresa WHERE calle = ? AND ciudad = ? LIMIT 1`,
        [envio.origen_calle, envio.origen_ciudad]
      );
      origenAlias = origenRows[0]?.alias || null;
    }

    // Buscar alias de la dirección de destino en direcciones_cliente
    let destinoAlias = null;
    if (envio.cliente_id && envio.destino_calle && envio.destino_ciudad) {
      const [destinoRows] = await db.query(
        `SELECT alias FROM direcciones_cliente WHERE cliente_id = ? AND calle = ? AND ciudad = ? LIMIT 1`,
        [envio.cliente_id, envio.destino_calle, envio.destino_ciudad]
      );
      destinoAlias = destinoRows[0]?.alias || null;
    }

    res.render('envios/guia-almex', {
      title: `Guía ${envio.numero_tracking}`,
      envio,
      items,
      config,
      origenAlias,
      destinoAlias
    });
  } catch (error) {
    console.error('Error al generar guía Almex:', error);
    res.status(500).send('Error al generar la guía');
  }
});

// Formulario crear nuevo envío
router.get('/nuevo/formulario', isAuthenticated, async (req, res) => {
  try {
    const [clientes] = await db.query(`
      SELECT 
        id,
        nombre_empresa,
        prefijo_tracking,
        ultimo_numero_tracking,
        CONCAT(prefijo_tracking, '-', LPAD(ultimo_numero_tracking + 1, 5, '0')) as proximo_tracking
      FROM clientes 
      WHERE activo = 1 AND eliminado_en IS NULL 
      ORDER BY nombre_empresa
    `);
    
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
    const { 
      cliente_id, 
      referencia_cliente,
      envio_relacionado_id,
      fecha_estimada_entrega,
      origen_calle,
      origen_colonia,
      origen_ciudad,
      origen_estado,
      origen_cp,
      origen_referencia,
      destino_calle,
      destino_colonia,
      destino_ciudad,
      destino_estado,
      destino_cp,
      destino_referencia
    } = req.body;
    
    // ⬅️ CONSTRUIR DIRECCIONES COMPLETAS
    const origen = construirDireccionCompleta(
      origen_calle, 
      origen_colonia, 
      origen_ciudad, 
      origen_estado, 
      origen_cp, 
      origen_referencia
    );
    
    const destino = construirDireccionCompleta(
      destino_calle, 
      destino_colonia, 
      destino_ciudad, 
      destino_estado, 
      destino_cp, 
      destino_referencia
    );
    
if (!cliente_id || !origen_calle || !origen_ciudad || !destino_calle || !destino_ciudad) {
        const [clientes] = await db.query(`
        SELECT 
          id,
          nombre_empresa,
          prefijo_tracking,
          ultimo_numero_tracking,
          CONCAT(prefijo_tracking, '-', LPAD(ultimo_numero_tracking + 1, 5, '0')) as proximo_tracking
        FROM clientes 
        WHERE activo = 1 AND eliminado_en IS NULL 
        ORDER BY nombre_empresa
      `);
      return res.render('envios/nuevo', {
        title: 'Crear Nuevo Envío',
        user: {
          id: req.session.userId,
          nombre: req.session.userName,
          email: req.session.userEmail,
          rol: req.session.userRole
        },
        clientes,
error: 'Cliente y direcciones completas (calle, ciudad) son obligatorios'
      });
    }
    
    // Calcular peso y descripcion desde items del formulario
    const _iCant = [].concat(req.body['item_cant'] || []);
    const _iTipo = [].concat(req.body['item_tipo']     || []);
    const _iDesc = [].concat(req.body['item_desc'] || []);
    const _iPeso = [].concat(req.body['item_peso']     || []);
    const peso = _iTipo.reduce((s,t,i) => s + (t&&t.trim() ? parseFloat(_iPeso[i])||0 : 0), 0);
    const descripcion = _iTipo.map((t,i) => t&&t.trim() ? `${_iCant[i]||1}x ${t.trim()}` : null).filter(Boolean).join(', ') || null;

    //  GENERAR TRACKING PERSONALIZADO POR CLIENTE
    const numeroTracking = await generarSiguienteTracking(cliente_id);

    // Obtener nombre del cliente para snapshot histórico
    const [clienteRows] = await db.query(
      'SELECT nombre_empresa FROM clientes WHERE id = ?', [cliente_id]
    );
    const cliente_nombre_snapshot = clienteRows.length > 0 ? clienteRows[0].nombre_empresa : null;
    
    // Parsear flags de parcial desde form (strings '0'/'1')
    const es_parcial     = req.body.es_parcial     === '1' ? 1 : 0;
    const es_complemento = req.body.es_complemento === '1' ? 1 : 0;

    // Calcular numero_parte
    let numeroParte = null;
    if (es_complemento === 1 && envio_relacionado_id) {
      const [partes] = await db.query(
        'SELECT COUNT(*) as total FROM envios WHERE envio_relacionado_id = ?',
        [parseInt(envio_relacionado_id)]
      );
      numeroParte = (partes[0].total || 0) + 2; // raíz=1, primer complemento=2, etc.
    } else if (es_parcial === 1) {
      numeroParte = 1; // la raíz siempre es parte 1
    }

    // Insertar en transacción
    const conn = await db.getConnection();
    let envioId;
    try {
      await conn.beginTransaction();

      const [result] = await conn.query(
        `INSERT INTO envios (
          numero_tracking, cliente_id, cliente_nombre, referencia_cliente,
          descripcion, peso, fecha_estimada_entrega, origen, destino,
          origen_calle, origen_colonia, origen_ciudad, origen_estado, origen_cp, origen_referencia,
          destino_calle, destino_colonia, destino_ciudad, destino_estado, destino_cp, destino_referencia,
          usuario_creador_id, es_parcial, es_complemento, envio_relacionado_id, numero_parte
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          numeroTracking, cliente_id, cliente_nombre_snapshot, referencia_cliente,
          descripcion, peso, fecha_estimada_entrega, origen, destino,
          origen_calle, origen_colonia, origen_ciudad, origen_estado, origen_cp, origen_referencia || null,
          destino_calle, destino_colonia, destino_ciudad, destino_estado, destino_cp, destino_referencia || null,
          req.session.userId, es_parcial, es_complemento,
          (es_complemento || es_parcial) && envio_relacionado_id ? parseInt(envio_relacionado_id) : null,
          numeroParte
        ]
      );

      envioId = result.insertId;

      for (let i = 0; i < _iTipo.length; i++) {
        if (_iTipo[i] && _iTipo[i].trim()) {
          await conn.query(
            'INSERT INTO envio_items (envio_id, cantidad, tipo, descripcion, peso) VALUES (?, ?, ?, ?, ?)',
            [envioId, parseInt(_iCant[i])||1, _iTipo[i].trim(),
             _iDesc[i] ? _iDesc[i].trim()||null : null,
             parseFloat(_iPeso[i])||0]
          );
        }
      }

      await conn.query(
        `INSERT INTO historial_estados (envio_id, estado, ubicacion, comentarios, usuario_id)
         VALUES (?, 'creado', ?, 'Envío creado', ?)`,
        [envioId, origen, req.session.userId]
      );

      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }

    console.log('✅ Envío creado:', numeroTracking);
    res.redirect(`/envios/${envioId}?success=creado`);

  } catch (error) {
    console.error('Error al crear envío:', error);
    const [clientes] = await db.query(`
      SELECT 
        id,
        nombre_empresa,
        prefijo_tracking,
        ultimo_numero_tracking,
        CONCAT(prefijo_tracking, '-', LPAD(ultimo_numero_tracking + 1, 5, '0')) as proximo_tracking
      FROM clientes 
      WHERE activo = 1 AND eliminado_en IS NULL 
      ORDER BY nombre_empresa
    `);
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
    const [clientes] = await db.query(
      'SELECT * FROM clientes WHERE activo = 1 AND eliminado_en IS NULL ORDER BY nombre_empresa'
    );
    
    if (envios.length === 0) {
      return res.status(404).send('Envío no encontrado');
    }
    
    const [itemsEditar] = await db.query(
      'SELECT * FROM envio_items WHERE envio_id = ? ORDER BY id ASC', [id]
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
      items: itemsEditar,
      error: null
    });
  } catch (error) {
    console.error('Error al cargar envío para editar:', error);
    res.status(500).send('Error al cargar el envío');
  }
});

// Actualizar envío (POST)
router.post('/:id/editar', isAuthenticated, async (req, res) => {
  const { id } = req.params;
  try {
    const {
      cliente_id,
      referencia_cliente,
      fecha_estimada_entrega,
      origen_calle,
      origen_colonia,
      origen_ciudad,
      origen_estado,
      origen_cp,
      origen_referencia,
      destino_calle,
      destino_colonia,
      destino_ciudad,
      destino_estado,
      destino_cp,
      destino_referencia
    } = req.body;

    const origen  = construirDireccionCompleta(origen_calle, origen_colonia, origen_ciudad, origen_estado, origen_cp, origen_referencia);
    const destino = construirDireccionCompleta(destino_calle, destino_colonia, destino_ciudad, destino_estado, destino_cp, destino_referencia);

    const _iCantE = [].concat(req.body['item_cant'] || []);
    const _iTipoE = [].concat(req.body['item_tipo'] || []);
    const _iDescE = [].concat(req.body['item_desc'] || []);
    const _iPesoE = [].concat(req.body['item_peso'] || []);
    const peso        = _iTipoE.reduce((s,t,i) => s + (t&&t.trim() ? parseFloat(_iPesoE[i])||0 : 0), 0);
    const descripcion = _iTipoE.map((t,i) => t&&t.trim() ? `${_iCantE[i]||1}x ${t.trim()}` : null).filter(Boolean).join(', ') || null;

    if (!cliente_id || !origen_calle || !origen_ciudad || !destino_calle || !destino_ciudad) {
      const [[envioRow], [clientes], [itemsVal]] = await Promise.all([
        db.query('SELECT * FROM envios WHERE id = ?', [id]),
        db.query('SELECT * FROM clientes WHERE activo = 1 AND eliminado_en IS NULL ORDER BY nombre_empresa'),
        db.query('SELECT * FROM envio_items WHERE envio_id = ? ORDER BY id ASC', [id])
      ]);
      return res.render('envios/editar', {
        title: 'Editar Envío',
        user: { id: req.session.userId, nombre: req.session.userName, email: req.session.userEmail, rol: req.session.userRole },
        envio: envioRow[0], clientes, items: itemsVal,
        error: 'Cliente y direcciones completas (calle, ciudad) son obligatorios'
      });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        `UPDATE envios SET
          cliente_id = ?, referencia_cliente = ?, descripcion = ?, peso = ?,
          fecha_estimada_entrega = ?,
          origen = ?, destino = ?,
          origen_calle = ?, origen_colonia = ?, origen_ciudad = ?, origen_estado = ?, origen_cp = ?, origen_referencia = ?,
          destino_calle = ?, destino_colonia = ?, destino_ciudad = ?, destino_estado = ?, destino_cp = ?, destino_referencia = ?
         WHERE id = ?`,
        [
          cliente_id, referencia_cliente, descripcion, peso, fecha_estimada_entrega,
          origen, destino,
          origen_calle, origen_colonia || null, origen_ciudad, origen_estado, origen_cp, origen_referencia || null,
          destino_calle, destino_colonia || null, destino_ciudad, destino_estado, destino_cp, destino_referencia || null,
          id
        ]
      );

      await conn.query('DELETE FROM envio_items WHERE envio_id = ?', [id]);
      for (let i = 0; i < _iTipoE.length; i++) {
        if (_iTipoE[i] && _iTipoE[i].trim()) {
          await conn.query(
            'INSERT INTO envio_items (envio_id, cantidad, tipo, descripcion, peso) VALUES (?, ?, ?, ?, ?)',
            [id, parseInt(_iCantE[i])||1, _iTipoE[i].trim(),
             _iDescE[i] ? _iDescE[i].trim()||null : null,
             parseFloat(_iPesoE[i])||0]
          );
        }
      }

      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }

    console.log('✅ Envío actualizado:', id);
    res.redirect(`/envios/${id}?success=actualizado`);

  } catch (error) {
    console.error('Error al actualizar envío:', error);
    const [[envioRow], [clientes], [itemsCatch]] = await Promise.all([
      db.query('SELECT * FROM envios WHERE id = ?', [id]),
      db.query('SELECT * FROM clientes WHERE activo = 1 AND eliminado_en IS NULL ORDER BY nombre_empresa'),
      db.query('SELECT * FROM envio_items WHERE envio_id = ? ORDER BY id ASC', [id]).catch(() => [[]])
    ]);
    res.render('envios/editar', {
      title: 'Editar Envío',
      user: { id: req.session.userId, nombre: req.session.userName, email: req.session.userEmail, rol: req.session.userRole },
      envio: envioRow[0], clientes, items: itemsCatch,
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
    
    // Solo admin y superusuario pueden cancelar
    if (!['admin', 'superusuario'].includes(req.session.userRole)) {
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
    const cantidad = req.query.cantidad || 1; 
    
    // Obtener información del envío
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
    
    // Obtener configuración desde configuracion_sistema
    let configuracion = {
      nombre_empresa: 'TRANSPORTES AB',
      eslogan: 'Entrega Segura y Confiable',
      telefono: '',
      email: '',
      sitio_web: '',
      telefono_adicional: '',
      logo_url: null,
      rfc: '',
      direccion: '',
      // Toggles individuales (true por defecto)
      mostrar_logo:               true,
      mostrar_eslogan:            true,
      mostrar_telefono:           true,
      mostrar_telefono_adicional: true,
      mostrar_email:              true,
      mostrar_sitio_web:          true,
      mostrar_rfc:                true,
      mostrar_direccion_fiscal:   true,
      mostrar_barcode:            true,
      mostrar_qr:                 true,
      mostrar_ruta:               true,
      mostrar_descripcion:        true
    };
    
    try {
      // Obtener configuración de la empresa y etiqueta
      const [config] = await db.query(`
        SELECT clave, valor 
        FROM configuracion_sistema 
        WHERE categoria IN ('empresa', 'etiqueta')
      `);
      
      if (config && config.length > 0) {
        config.forEach(item => {
          switch(item.clave) {
            // Datos empresa
            case 'empresa_nombre':              configuracion.nombre_empresa        = item.valor || 'TRANSPORTES AB'; break;
            case 'empresa_eslogan':             configuracion.eslogan               = item.valor || ''; break;
            case 'empresa_telefono':            configuracion.telefono              = item.valor || ''; break;
            case 'empresa_telefono_adicional':  configuracion.telefono_adicional    = item.valor || ''; break;
            case 'empresa_email':               configuracion.email                 = item.valor || ''; break;
            case 'empresa_sitio_web':           configuracion.sitio_web             = item.valor || ''; break;
            case 'empresa_logo_url':            configuracion.logo_url              = item.valor || null; break;
            case 'empresa_rfc':                 configuracion.rfc                   = item.valor || ''; break;
            case 'empresa_direccion':           configuracion.direccion             = item.valor || ''; break;
            // Toggles individuales
            case 'etiqueta_mostrar_logo':               configuracion.mostrar_logo               = item.valor !== 'false'; break;
            case 'etiqueta_mostrar_eslogan':            configuracion.mostrar_eslogan            = item.valor !== 'false'; break;
            case 'etiqueta_mostrar_telefono':           configuracion.mostrar_telefono           = item.valor !== 'false'; break;
            case 'etiqueta_mostrar_telefono_adicional': configuracion.mostrar_telefono_adicional = item.valor !== 'false'; break;
            case 'etiqueta_mostrar_email':              configuracion.mostrar_email              = item.valor !== 'false'; break;
            case 'etiqueta_mostrar_sitio_web':          configuracion.mostrar_sitio_web          = item.valor !== 'false'; break;
            case 'etiqueta_mostrar_rfc':                configuracion.mostrar_rfc                = item.valor !== 'false'; break;
            case 'etiqueta_mostrar_direccion_fiscal':   configuracion.mostrar_direccion_fiscal   = item.valor !== 'false'; break;
            case 'etiqueta_mostrar_barcode':            configuracion.mostrar_barcode            = item.valor !== 'false'; break;
            case 'etiqueta_mostrar_qr':                 configuracion.mostrar_qr                 = item.valor !== 'false'; break;
            case 'etiqueta_mostrar_ruta':               configuracion.mostrar_ruta               = item.valor !== 'false'; break;
            case 'etiqueta_mostrar_descripcion':        configuracion.mostrar_descripcion        = item.valor !== 'false'; break;
          }
        });
      }
    } catch (error) {
      console.log('Error al obtener configuración, usando valores por defecto:', error.message);
    }
    
    // Agregar configuracion y baseUrl al render
    const [itemsEtiq] = await db.query(
      'SELECT * FROM envio_items WHERE envio_id = ? ORDER BY id ASC', [id]
    );
    // Para mostrar PARTE x/x en etiqueta
    const envioData = envios[0];
    let guiasRelEtiq = [];
    if (envioData.es_parcial) {
      const [comps] = await db.query(
        'SELECT id FROM envios WHERE envio_relacionado_id = ? ORDER BY numero_parte ASC', [id]
      );
      guiasRelEtiq = comps;
    } else if (envioData.es_complemento && envioData.envio_relacionado_id) {
      const [comps] = await db.query(
        'SELECT id FROM envios WHERE envio_relacionado_id = ? ORDER BY numero_parte ASC',
        [envioData.envio_relacionado_id]
      );
      guiasRelEtiq = comps;
    }
    res.render('envios/etiquetaT', {
      title: 'Etiqueta de Envío',
      envio: envioData,
      cantidad: parseInt(cantidad),
      baseUrl: `${req.protocol}://${req.get('host')}`,
      configuracion: configuracion,
      items: itemsEtiq,
      guiasRelacionadas: guiasRelEtiq,
      user: {
        nombre: req.session.userName || 'Usuario',
        email: req.session.userEmail || 'usuario@sistema.com',
        rol: req.session.userRole || 'operador'
      }
    });
  } catch (error) {
    console.error('Error al generar etiqueta:', error);
    res.status(500).send('Error al generar la etiqueta');
  }
});


// Guías de un cliente para selector de guía parcial
router.get('/parciales-por-cliente/:clienteId', isAuthenticated, async (req, res) => {
  try {
    const { clienteId } = req.params;
    const [envios] = await db.query(
      `SELECT id, numero_tracking, fecha_creacion, estado_actual
       FROM envios 
       WHERE cliente_id = ? AND es_parcial = 1
       ORDER BY fecha_creacion DESC LIMIT 50`,
      [clienteId]
    );
    res.json({ success: true, envios });
  } catch (error) {
    res.json({ success: false, envios: [] });
  }
});

// Items de un envío como JSON (para pre-cargar en guía parcial)
router.get('/:id/items-json', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const [items] = await db.query(
      'SELECT cantidad, tipo, descripcion, peso FROM envio_items WHERE envio_id = ? ORDER BY id ASC',
      [id]
    );
    res.json({ success: true, items });
  } catch (error) {
    res.json({ success: false, items: [] });
  }
});

module.exports = router;