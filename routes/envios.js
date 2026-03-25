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

    const esOperador = req.session.userRole === 'operador';
    let whereClause = ' WHERE 1=1';
    const params = [];

    if (esOperador) {
      whereClause += ` AND e.cliente_id IN (SELECT cliente_id FROM cliente_operadores WHERE usuario_id = ?)`;
      params.push(req.session.userId);
    }

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
        COALESCE(u.alias, u.nombre) as creador_nombre
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
        COALESCE(u.alias, u.nombre) as creador_nombre
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
        COALESCE(u.alias, u.nombre) as usuario_nombre
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

    const [pictogramasEnvio] = await db.query(
      `SELECT p.id FROM envio_pictogramas ep
       JOIN pictogramas p ON p.id = ep.pictograma_id
       WHERE ep.envio_id = ? AND p.activo = 1 LIMIT 1`, [id]
    ).catch(() => [[]]);
    const tienePictogramas = pictogramasEnvio.length > 0;

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
      tienePictogramas,
      success
    });
  } catch (error) {
    console.error('Error al obtener detalle del envío:', error);
    res.status(500).send('Error al cargar el detalle');
  }
});

// Guía Expedida del envío
router.get('/:id/guia-expedida', isAuthenticated, async (req, res) => {
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
      "SELECT clave, valor FROM configuracion_sistema WHERE clave IN ('empresa_nombre','empresa_rfc','empresa_telefono','empresa_telefono_adicional','empresa_direccion','empresa_logo_url','empresa_sitio_web','empresa_aviso_privacidad','lugares_expedicion')"
    );
    const config = {};
    configs.forEach(c => { config[c.clave] = c.valor; });

    // Lugares de expedición y último usado por el usuario
    const lugaresExpedicion = (config.lugares_expedicion || '')
      .split('\n').map(l => l.trim()).filter(Boolean);
    const [[usuarioRow]] = await db.query(
      'SELECT ultimo_lugar_expedicion FROM usuarios WHERE id = ?', [req.session.userId]
    );
    const lugarGuardado = usuarioRow?.ultimo_lugar_expedicion || '';
    // Usar guardado si sigue en la lista; si solo hay 1 opción, auto-seleccionar; si no, vacío
    const lugarExpedicion = lugaresExpedicion.includes(lugarGuardado)
      ? lugarGuardado
      : (lugaresExpedicion.length === 1 ? lugaresExpedicion[0] : '');

    // Cargar template de guía asignado al cliente
    const guiaCfgDefaults = {
      mostrar_logo:1,mostrar_rfc:1,mostrar_telefono:1,mostrar_sitio_web:1,mostrar_barcode:1,
      mostrar_seccion_remitente:1,mostrar_remitente_nombre:1,mostrar_remitente_direccion:1,mostrar_remitente_telefono:1,
      mostrar_seccion_facturar:1,mostrar_facturar_nombre:1,mostrar_facturar_direccion:1,mostrar_facturar_contacto:1,mostrar_facturar_telefono:1,mostrar_facturar_email:1,mostrar_facturar_rfc:1,
      mostrar_seccion_destinatario:1,mostrar_destinatario_nombre:1,mostrar_destinatario_direccion:1,
      mostrar_clausula_seguro:1,mostrar_retorno_documentos:1,mostrar_condiciones_pago:1,
      mostrar_fecha_emision:1,mostrar_observaciones:1,mostrar_fecha_entrega:1,
      mostrar_referencia_cliente:1,mostrar_recibido_por:1,mostrar_operador:1,
      mostrar_firma_final:1,mostrar_pie_datos:1,mostrar_disclaimer:1,
      mostrar_col_volumen:1,mostrar_col_peso_facturado:1,mostrar_col_servicios:1,mostrar_col_importe:1,
      obligatorio_logo:0,obligatorio_rfc:0,obligatorio_telefono:0,obligatorio_sitio_web:0,obligatorio_barcode:0,
      obligatorio_seccion_remitente:0,obligatorio_remitente_nombre:0,obligatorio_remitente_direccion:0,obligatorio_remitente_telefono:0,
      obligatorio_seccion_facturar:0,obligatorio_facturar_nombre:0,obligatorio_facturar_direccion:0,obligatorio_facturar_contacto:0,obligatorio_facturar_telefono:0,obligatorio_facturar_email:0,obligatorio_facturar_rfc:0,
      obligatorio_seccion_destinatario:0,obligatorio_destinatario_nombre:0,obligatorio_destinatario_direccion:0,
      obligatorio_clausula_seguro:0,obligatorio_retorno_documentos:0,obligatorio_condiciones_pago:0,
      obligatorio_fecha_emision:0,obligatorio_observaciones:0,obligatorio_fecha_entrega:0,
      obligatorio_referencia_cliente:0,obligatorio_recibido_por:0,obligatorio_operador:0,
      obligatorio_firma_final:0,obligatorio_pie_datos:0,obligatorio_disclaimer:0,
      obligatorio_col_volumen:0,obligatorio_col_peso_facturado:0,obligatorio_col_servicios:0,obligatorio_col_importe:0,
      // Textos editables por template
      descripcion_servicio: null,
      titulo_guia: null,
      mensaje_1: null,
      mensaje_2: null,
      mensaje_3: null,
      mensaje_4: null,
      etiqueta_col_descripcion: null,
      etiqueta_operador: null,
      etiqueta_obs_operador: null,
      etiqueta_recibido_por: null,
      etiqueta_obs_recibido: null,
      // Toggles adicionales
      mostrar_obs_operador: 1, obligatorio_obs_operador: 0,
      mostrar_obs_recibido: 1, obligatorio_obs_recibido: 0,
      // Tamaños de texto (null = usar CSS default)
      size_guia_titulo: null,
      size_tracking_big: null,
      size_company_name: null,
      size_seccion_content: null,
      size_cargo_td: null,
      size_guia_servicio: null,
      size_seccion_label: null,
      size_cargo_th: null,
      size_footer_content: null,
      size_pago_big: null,
      size_msg_row: null
    };
    let guiaCfg = { ...guiaCfgDefaults };
    if (envio.cliente_id) {
      const [[clienteGuia]] = await db.query('SELECT template_guia_id FROM clientes WHERE id = ?', [envio.cliente_id]);
      if (clienteGuia && clienteGuia.template_guia_id) {
        const [[tplGuia]] = await db.query('SELECT * FROM guia_templates WHERE id = ?', [clienteGuia.template_guia_id]);
        if (tplGuia) {
          Object.keys(guiaCfgDefaults).forEach(k => {
            if (k === 'descripcion_servicio' || k === 'titulo_guia' || k.startsWith('mensaje_') || k.startsWith('etiqueta_')) {
              guiaCfg[k] = tplGuia[k] || null;
            } else if (k.startsWith('size_')) {
              guiaCfg[k] = tplGuia[k] ? parseInt(tplGuia[k]) : null;
            } else {
              guiaCfg[k] = !!tplGuia[k];
            }
          });
          // Obligatorio fuerza mostrar
          Object.keys(guiaCfgDefaults).filter(k => k.startsWith('obligatorio_')).forEach(k => {
            if (guiaCfg[k]) guiaCfg['mostrar_' + k.replace('obligatorio_','')] = true;
          });
        }
      }
    }

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

    res.render('envios/guia-expedida', {
      title: `Guía ${envio.numero_tracking}`,
      envio,
      items,
      config,
      guiaCfg,
      origenAlias,
      destinoAlias,
      lugaresExpedicion,
      lugarExpedicion,
      user: { rol: req.session.userRole, id: req.session.userId }
    });
  } catch (error) {
    console.error('Error al generar guía Almex:', error);
    res.status(500).send('Error al generar la guía');
  }
});

// Guardar último lugar de expedición del usuario
router.post('/api/lugar-expedicion', isAuthenticated, async (req, res) => {
  try {
    const { lugar } = req.body;
    await db.query('UPDATE usuarios SET ultimo_lugar_expedicion = ? WHERE id = ?', [lugar || null, req.session.userId]);
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false });
  }
});

// Alias /nuevo → /nuevo/formulario (preserva query string)
router.get('/nuevo', isAuthenticated, (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  res.redirect('/envios/nuevo/formulario' + (qs ? '?' + qs : ''));
});

// Formulario crear nuevo envío
router.get('/nuevo/formulario', isAuthenticated, async (req, res) => {
  try {
    const esOperador = req.session.userRole === 'operador';
    const clientesQuery = esOperador
      ? `SELECT c.id, c.nombre_empresa, c.prefijo_tracking, c.ultimo_numero_tracking,
           CONCAT(c.prefijo_tracking, '-', LPAD(c.ultimo_numero_tracking + 1, 5, '0')) as proximo_tracking
         FROM clientes c
         INNER JOIN cliente_operadores co ON co.cliente_id = c.id
         WHERE c.activo = 1 AND c.eliminado_en IS NULL AND co.usuario_id = ?
         ORDER BY c.nombre_empresa`
      : `SELECT id, nombre_empresa, prefijo_tracking, ultimo_numero_tracking,
           CONCAT(prefijo_tracking, '-', LPAD(ultimo_numero_tracking + 1, 5, '0')) as proximo_tracking
         FROM clientes WHERE activo = 1 AND eliminado_en IS NULL ORDER BY nombre_empresa`;
    const clientesParams = esOperador ? [req.session.userId] : [];
    const [clientes] = await db.query(clientesQuery, clientesParams);

    const [[usuarioRow]] = await db.query('SELECT ultimo_cliente_id FROM usuarios WHERE id = ?', [req.session.userId]);
    const ultimoClienteId = parseInt(req.query.cliente_id) || usuarioRow?.ultimo_cliente_id || null;
    const [pictogramas] = await db.query(
      'SELECT id, nombre, imagen_url FROM pictogramas WHERE activo = 1 ORDER BY orden ASC, nombre ASC'
    ).catch(() => [[]]);
    const [tiposEmpaques] = await db.query(
      'SELECT id, nombre FROM tipos_empaques WHERE activo = 1 ORDER BY orden ASC, nombre ASC'
    ).catch(() => [[]]);

    res.render('envios/nuevo', {
      title: 'Crear Nuevo Envío',
      user: {
        id: req.session.userId,
        nombre: req.session.userName,
        email: req.session.userEmail,
        rol: req.session.userRole
      },
      clientes,
      ultimoClienteId,
      pictogramas: pictogramas || [],
      tiposEmpaques: tiposEmpaques || [],
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
        const esOp = req.session.userRole === 'operador';
        const [clientes] = await db.query(
          esOp
            ? `SELECT c.id, c.nombre_empresa, c.prefijo_tracking, c.ultimo_numero_tracking,
                 CONCAT(c.prefijo_tracking, '-', LPAD(c.ultimo_numero_tracking + 1, 5, '0')) as proximo_tracking
               FROM clientes c INNER JOIN cliente_operadores co ON co.cliente_id = c.id
               WHERE c.activo = 1 AND c.eliminado_en IS NULL AND co.usuario_id = ? ORDER BY c.nombre_empresa`
            : `SELECT id, nombre_empresa, prefijo_tracking, ultimo_numero_tracking,
                 CONCAT(prefijo_tracking, '-', LPAD(ultimo_numero_tracking + 1, 5, '0')) as proximo_tracking
               FROM clientes WHERE activo = 1 AND eliminado_en IS NULL ORDER BY nombre_empresa`,
          esOp ? [req.session.userId] : []
        );
      const [tiposEmpaquesVal] = await db.query(
        'SELECT id, nombre FROM tipos_empaques WHERE activo = 1 ORDER BY orden ASC, nombre ASC'
      ).catch(() => [[]]);
      return res.render('envios/nuevo', {
        title: 'Crear Nuevo Envío',
        user: {
          id: req.session.userId,
          nombre: req.session.userName,
          email: req.session.userEmail,
          rol: req.session.userRole
        },
        clientes,
        ultimoClienteId: parseInt(cliente_id) || null,
        pictogramas: [],
        tiposEmpaques: tiposEmpaquesVal || [],
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

    // Obtener nombre y metodo_pago del cliente para snapshot histórico
    const [clienteRows] = await db.query(
      'SELECT nombre_empresa, metodo_pago_defecto FROM clientes WHERE id = ?', [cliente_id]
    );
    const cliente_nombre_snapshot = clienteRows.length > 0 ? clienteRows[0].nombre_empresa : null;

    // Respetar crédito solo si está habilitado globalmente
    const [[cfgCredito]] = await db.query("SELECT valor FROM configuracion_sistema WHERE clave = 'credito_habilitado'").catch(() => [[null]]);
    const creditoGlobalHabilitado = !cfgCredito || cfgCredito.valor !== 'false';
    const metodo_pago_cliente = (clienteRows.length > 0 && clienteRows[0].metodo_pago_defecto) ? clienteRows[0].metodo_pago_defecto : 'PPD';
    const metodo_pago_envio = creditoGlobalHabilitado ? metodo_pago_cliente : 'PUE';
    
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
          usuario_creador_id, es_parcial, es_complemento, envio_relacionado_id, numero_parte, metodo_pago
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          numeroTracking, cliente_id, cliente_nombre_snapshot, referencia_cliente,
          descripcion, peso, fecha_estimada_entrega, origen, destino,
          origen_calle, origen_colonia, origen_ciudad, origen_estado, origen_cp, origen_referencia || null,
          destino_calle, destino_colonia, destino_ciudad, destino_estado, destino_cp, destino_referencia || null,
          req.session.userId, es_parcial, es_complemento,
          (es_complemento || es_parcial) && envio_relacionado_id ? parseInt(envio_relacionado_id) : null,
          numeroParte, metodo_pago_envio
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

    // Guardar pictogramas seleccionados
    const pictoIds = [].concat(req.body.pictogramas || []).map(Number).filter(Boolean);
    if (pictoIds.length > 0) {
      for (const pid of pictoIds) {
        await db.query(
          'INSERT IGNORE INTO envio_pictogramas (envio_id, pictograma_id) VALUES (?, ?)',
          [envioId, pid]
        );
      }
    }

    // Guardar último cliente usado por este usuario
    await db.query('UPDATE usuarios SET ultimo_cliente_id = ? WHERE id = ?', [cliente_id, req.session.userId]);

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
    const [tiposEmpaquesErr] = await db.query(
      'SELECT id, nombre FROM tipos_empaques WHERE activo = 1 ORDER BY orden ASC, nombre ASC'
    ).catch(() => [[]]);
    res.render('envios/nuevo', {
      title: 'Crear Nuevo Envío',
      user: {
        id: req.session.userId,
        nombre: req.session.userName,
        email: req.session.userEmail,
        rol: req.session.userRole
      },
      clientes,
      ultimoClienteId: parseInt(req.body?.cliente_id) || null,
      pictogramas: [],
      tiposEmpaques: tiposEmpaquesErr || [],
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
    const [pictogramas] = await db.query(
      'SELECT id, nombre, imagen_url FROM pictogramas WHERE activo = 1 ORDER BY orden ASC, nombre ASC'
    ).catch(() => [[]]);
    const [pictoEnvio] = await db.query(
      'SELECT pictograma_id FROM envio_pictogramas WHERE envio_id = ?', [id]
    ).catch(() => [[]]);
    const pictoIdsEnvio = (pictoEnvio || []).map(r => r.pictograma_id);
    const [tiposEmpaquesEditar] = await db.query(
      'SELECT id, nombre FROM tipos_empaques WHERE activo = 1 ORDER BY orden ASC, nombre ASC'
    ).catch(() => [[]]);

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
      pictogramas: pictogramas || [],
      pictoIdsEnvio,
      tiposEmpaques: tiposEmpaquesEditar || [],
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
      const [tiposEmpaquesEditVal] = await db.query(
        'SELECT id, nombre FROM tipos_empaques WHERE activo = 1 ORDER BY orden ASC, nombre ASC'
      ).catch(() => [[]]);
      return res.render('envios/editar', {
        title: 'Editar Envío',
        user: { id: req.session.userId, nombre: req.session.userName, email: req.session.userEmail, rol: req.session.userRole },
        envio: envioRow[0], clientes, items: itemsVal,
        pictogramas: [], pictoIdsEnvio: [],
        tiposEmpaques: tiposEmpaquesEditVal || [],
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

    // Actualizar pictogramas (borrar los actuales y reinsertar los seleccionados)
    await db.query('DELETE FROM envio_pictogramas WHERE envio_id = ?', [id]);
    const pictoIdsEdit = [].concat(req.body.pictogramas || []).map(Number).filter(Boolean);
    for (const pid of pictoIdsEdit) {
      await db.query(
        'INSERT IGNORE INTO envio_pictogramas (envio_id, pictograma_id) VALUES (?, ?)',
        [id, pid]
      );
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
    const [tiposEmpaquesEditErr] = await db.query(
      'SELECT id, nombre FROM tipos_empaques WHERE activo = 1 ORDER BY orden ASC, nombre ASC'
    ).catch(() => [[]]);
    res.render('envios/editar', {
      title: 'Editar Envío',
      user: { id: req.session.userId, nombre: req.session.userName, email: req.session.userEmail, rol: req.session.userRole },
      envio: envioRow[0], clientes, items: itemsCatch,
      pictogramas: [], pictoIdsEnvio: [],
      tiposEmpaques: tiposEmpaquesEditErr || [],
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
      // Toggles individuales — por defecto todos activos
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
      mostrar_descripcion:        true,
      // Obligatorio — por defecto ninguno
      obligatorio_logo:               false,
      obligatorio_eslogan:            false,
      obligatorio_telefono:           false,
      obligatorio_telefono_adicional: false,
      obligatorio_email:              false,
      obligatorio_sitio_web:          false,
      obligatorio_rfc:                false,
      obligatorio_direccion_fiscal:   false,
      obligatorio_barcode:            false,
      obligatorio_qr:                 false,
      obligatorio_ruta:               false,
      obligatorio_descripcion:        false
    };

    try {
      // Obtener configuración de empresa
      const [config] = await db.query(`
        SELECT clave, valor FROM configuracion_sistema WHERE categoria IN ('empresa', 'etiqueta')
      `);
      if (config && config.length > 0) {
        config.forEach(item => {
          switch(item.clave) {
            case 'empresa_nombre':              configuracion.nombre_empresa        = item.valor || 'TRANSPORTES AB'; break;
            case 'empresa_eslogan':             configuracion.eslogan               = item.valor || ''; break;
            case 'empresa_telefono':            configuracion.telefono              = item.valor || ''; break;
            case 'empresa_telefono_adicional':  configuracion.telefono_adicional    = item.valor || ''; break;
            case 'empresa_email':               configuracion.email                 = item.valor || ''; break;
            case 'empresa_sitio_web':           configuracion.sitio_web             = item.valor || ''; break;
            case 'empresa_logo_url':            configuracion.logo_url              = item.valor || null; break;
            case 'empresa_logo_bw_url':         configuracion.logo_bw_url           = item.valor || null; break;
            case 'empresa_rfc':                 configuracion.rfc                   = item.valor || ''; break;
            case 'empresa_direccion':           configuracion.direccion             = item.valor || ''; break;
          }
        });
      }

      // Si el cliente tiene un template asignado, usar sus ajustes
      const envioData0 = envios[0];
      if (envioData0.cliente_id) {
        const [[clienteRow]] = await db.query(
          'SELECT template_etiqueta_id FROM clientes WHERE id = ?', [envioData0.cliente_id]
        );
        if (clienteRow && clienteRow.template_etiqueta_id) {
          const [[tpl]] = await db.query(
            'SELECT * FROM etiqueta_templates WHERE id = ?', [clienteRow.template_etiqueta_id]
          );
          if (tpl) {
            const keys = ['logo','eslogan','telefono','telefono_adicional','email','sitio_web','rfc','direccion_fiscal','barcode','qr','ruta','descripcion','dest_contacto','dest_telefono','dest_nombre','dest_direccion','dest_referencia','alias_ruta','peso_total','peso_item'];
            keys.forEach(k => {
              configuracion['mostrar_' + k]    = !!tpl['mostrar_' + k];
              configuracion['obligatorio_' + k] = !!tpl['obligatorio_' + k];
              // Obligatorio fuerza mostrar
              if (configuracion['obligatorio_' + k]) configuracion['mostrar_' + k] = true;
            });
            // Textos editables del template
            const textKeys = [
              'texto_entregar_a','texto_peso','texto_peso_item','texto_entrega_estimada','texto_ref_cliente',
              'texto_descripcion','texto_fecha_emision','texto_etiqueta'
            ];
            textKeys.forEach(k => { if (tpl[k]) configuracion[k] = tpl[k]; });
            // Tamaños de texto del template
            const sizeKeys = [
              'size_tracking','size_ruta_ciudad','size_dest_nombre','size_dest_direccion','size_empresa_nombre',
              'size_eslogan','size_tipo_servicio','size_detalle_valor','size_descripcion','size_dest_contacto',
              'size_barra_contacto','size_ruta_etiqueta','size_detalle_etiqueta','size_cab_fecha','size_cab_num'
            ];
            sizeKeys.forEach(k => { if (tpl[k]) configuracion[k] = tpl[k]; });
          }
        }
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
    // Alias de sucursal para la banda de ruta de la etiqueta
    let origenAliasEtq = null;
    if (envioData.origen_calle && envioData.origen_ciudad) {
      const [origenRowsEtq] = await db.query(
        'SELECT alias FROM direcciones_empresa WHERE calle = ? AND ciudad = ? LIMIT 1',
        [envioData.origen_calle, envioData.origen_ciudad]
      );
      origenAliasEtq = origenRowsEtq[0]?.alias || null;
    }
    let destinoAliasEtq = null;
    if (envioData.cliente_id && envioData.destino_calle && envioData.destino_ciudad) {
      const [destinoRowsEtq] = await db.query(
        'SELECT alias FROM direcciones_cliente WHERE cliente_id = ? AND calle = ? AND ciudad = ? LIMIT 1',
        [envioData.cliente_id, envioData.destino_calle, envioData.destino_ciudad]
      );
      destinoAliasEtq = destinoRowsEtq[0]?.alias || null;
    }

    // Pictogramas del envío
    const [pictosEnvio] = await db.query(`
      SELECT p.id, p.nombre, p.imagen_url
      FROM envio_pictogramas ep
      JOIN pictogramas p ON p.id = ep.pictograma_id
      WHERE ep.envio_id = ? AND p.activo = 1
      ORDER BY p.orden ASC, p.nombre ASC
    `, [id]).catch(() => [[]]);

    res.render('envios/etiquetaT', {
      title: 'Etiqueta de Envío',
      envio: envioData,
      cantidad: parseInt(cantidad),
      baseUrl: `${req.protocol}://${req.get('host')}`,
      configuracion: configuracion,
      items: itemsEtiq,
      guiasRelacionadas: guiasRelEtiq,
      pictogramas: pictosEnvio || [],
      origenAlias: origenAliasEtq,
      destinoAlias: destinoAliasEtq,
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


// Vista de carta para imprimir pictogramas
router.get('/:id/pictograma-carta', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const [envios] = await db.query('SELECT * FROM envios WHERE id = ?', [id]);
    if (!envios.length) return res.status(404).send('Envío no encontrado');
    const envio = envios[0];

    const [pictogramas] = await db.query(`
      SELECT p.id, p.nombre, p.imagen_url
      FROM envio_pictogramas ep
      JOIN pictogramas p ON p.id = ep.pictograma_id
      WHERE ep.envio_id = ? AND p.activo = 1
      ORDER BY p.orden ASC, p.nombre ASC
    `, [id]);

    res.render('envios/pictograma-carta', {
      title: 'Pictogramas - ' + envio.numero_tracking,
      envio,
      pictogramas: pictogramas || [],
      user: { nombre: req.session.userName, rol: req.session.userRole }
    });
  } catch (error) {
    console.error('Error al cargar pictograma-carta:', error);
    res.status(500).send('Error al cargar la vista');
  }
});

// Marcar que la etiqueta fue impresa con modificaciones de toggles
router.post('/:id/marcar-etiqueta-modificada', isAuthenticated, async (req, res) => {
  try {
    await db.query('UPDATE envios SET etiqueta_modificada = 1 WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false });
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