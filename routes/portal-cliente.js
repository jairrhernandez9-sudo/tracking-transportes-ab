const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const { isAuthenticated } = require('../middleware/auth');
const { requireCliente }  = require('../middleware/roles');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

// Multer para logo del cliente
const storageClienteLogo = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'public/uploads/clientes';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, `cliente_${req.session.clienteId}_${Date.now()}${path.extname(file.originalname)}`);
  }
});
const uploadClienteLogo = multer({
  storage: storageClienteLogo,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    if (/jpeg|jpg|png|gif|webp|svg/.test(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Solo imágenes'));
  }
});

// Middleware combinado: autenticado + rol cliente
const soloCliente = [isAuthenticated, requireCliente];

// Helper: página "documento no generado aún"
function portalDocNoGenerado(tipo, tracking, envioId) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${tipo} no disponible</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',sans-serif;background:#f1f5f9;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px}
    .card{background:white;border-radius:16px;padding:48px 40px;text-align:center;max-width:420px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,0.08)}
    .icon{font-size:48px;margin-bottom:16px}
    h1{font-size:1.25rem;font-weight:800;color:#0f172a;margin-bottom:8px}
    p{font-size:0.9rem;color:#64748b;line-height:1.6;margin-bottom:24px}
    .tracking{display:inline-block;background:#eff6ff;color:#2563eb;font-family:monospace;font-weight:700;padding:4px 12px;border-radius:8px;font-size:0.85rem;margin-bottom:20px}
    a{display:inline-flex;align-items:center;gap:6px;padding:10px 20px;background:#2563eb;color:white;border-radius:10px;text-decoration:none;font-size:0.875rem;font-weight:700;transition:background .2s}
    a:hover{background:#1d4ed8}
  </style></head>
  <body>
    <div class="card">
      <div class="icon">📄</div>
      <div class="tracking">${tracking}</div>
      <h1>${tipo} aún no generada</h1>
      <p>El operador todavía no ha generado este documento. Vuelve a consultarlo más tarde.</p>
      <a href="/portal-cliente/envio/${envioId}">← Volver al detalle</a>
    </div>
  </body></html>`;
}

// ── GET / — Portal principal del cliente ──────────────────
router.get('/', soloCliente, async (req, res) => {
  try {
    const clienteId = req.session.clienteId;
    if (!clienteId) {
      return res.redirect('/auth/logout');
    }

    // Logo de la empresa
    const [[logoRow]] = await db.query(
      "SELECT valor FROM configuracion_sistema WHERE clave = 'empresa_logo_url'"
    );
    const logoUrl = logoRow?.valor || null;

    const { buscar, estado, direccion_id, page } = req.query;
    const porPagina = 20;
    const pagina    = Math.max(1, parseInt(page) || 1);
    const offset    = (pagina - 1) * porPagina;

    // Info del cliente
    const [clienteRows] = await db.query(
      'SELECT * FROM clientes WHERE id = ?', [clienteId]
    );
    const cliente = clienteRows[0];

    // Si el cliente está deshabilitado, mostrar portal bloqueado
    if (!cliente || cliente.habilitado === 0) {
      return res.render('portal-cliente', {
        title: 'Portal de Seguimiento',
        user: { nombre: req.session.userName, email: req.session.userEmail, rol: req.session.userRole, clienteId },
        cliente: cliente || { nombre_empresa: 'Cliente' },
        portalDeshabilitado: true,
        envios: [], stats: { total: 0, creados: 0, en_transito: 0, entregados: 0 },
        direcciones: [], filtros: {}, logoUrl: logoUrl || null,
        clienteLogoUrl: cliente?.logo_url || null,
        sucursalLabel: 'Todos los envíos',
        paginacion: { actual: 1, total: 0, porPagina: 20 }
      });
    }

    // Direcciones del cliente para el filtro
    const [direcciones] = await db.query(
      `SELECT id, alias, calle, ciudad, estado, cp, tipo
       FROM direcciones_cliente
       WHERE cliente_id = ? AND activa = 1
       ORDER BY es_predeterminada DESC, alias ASC`,
      [clienteId]
    );

    // Sucursales asignadas al usuario (multi)
    const [userSucs] = await db.query(
      `SELECT d.calle, d.ciudad, d.alias FROM usuario_sucursales us
       JOIN direcciones_cliente d ON us.sucursal_dir_id = d.id
       WHERE us.usuario_id = ?`,
      [req.session.userId]
    );

    // Etiqueta de sucursal para el portal header
    let sucursalLabel;
    if (userSucs.length === 0) sucursalLabel = 'Todos los envíos';
    else if (userSucs.length === 1) sucursalLabel = userSucs[0].alias || userSucs[0].ciudad;
    else sucursalLabel = `${userSucs.length} sucursales`;

    // Query de envíos
    let where  = 'WHERE e.cliente_id = ?';
    const params = [clienteId];

    // Aplicar filtro de sucursales automáticamente
    if (userSucs.length > 0) {
      const conds = userSucs.map(() => '((e.origen_calle=? AND e.origen_ciudad=?) OR (e.destino_calle=? AND e.destino_ciudad=?))').join(' OR ');
      where += ` AND (${conds})`;
      userSucs.forEach(s => params.push(s.calle, s.ciudad, s.calle, s.ciudad));
    }

    if (buscar) {
      where += ` AND (e.numero_tracking LIKE ? OR e.referencia_cliente LIKE ?
                 OR FIND_IN_SET(?, REPLACE(e.referencia_cliente, ', ', ',')) > 0)`;
      const t = `%${buscar}%`;
      params.push(t, t, buscar);
    }

    if (estado && estado !== 'todos') {
      where += ' AND e.estado_actual = ?';
      params.push(estado);
    }

    // Filtro por dirección (alias) — busca en origen o destino según tipo
    if (direccion_id) {
      const [dirRows] = await db.query(
        'SELECT * FROM direcciones_cliente WHERE id = ? AND cliente_id = ?',
        [direccion_id, clienteId]
      );
      if (dirRows.length > 0) {
        const dir = dirRows[0];
        if (dir.tipo === 'origen') {
          where += ` AND (e.origen_calle = ? AND e.origen_ciudad = ?)`;
          params.push(dir.calle, dir.ciudad);
        } else if (dir.tipo === 'destino') {
          where += ` AND (e.destino_calle = ? AND e.destino_ciudad = ?)`;
          params.push(dir.calle, dir.ciudad);
        } else {
          // tipo 'ambos' — busca en origen O destino
          where += ` AND (
            (e.origen_calle = ? AND e.origen_ciudad = ?) OR
            (e.destino_calle = ? AND e.destino_ciudad = ?)
          )`;
          params.push(dir.calle, dir.ciudad, dir.calle, dir.ciudad);
        }
      }
    }

    // Total para paginación
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM envios e ${where}`, params
    );

    // Envíos paginados
    const [envios] = await db.query(
      `SELECT e.numero_tracking, e.referencia_cliente, e.estado_actual,
              e.origen, e.destino, e.fecha_creacion, e.fecha_estimada_entrega,
              e.es_parcial, e.es_complemento, e.numero_parte, e.id
       FROM envios e
       ${where}
       ORDER BY e.fecha_creacion DESC
       LIMIT ? OFFSET ?`,
      [...params, porPagina, offset]
    );

    // Stats rápidas (respetan filtro de sucursales)
    let statsWhere = 'WHERE cliente_id = ?';
    const statsParams = [clienteId];
    if (userSucs.length > 0) {
      const sConds = userSucs.map(() => '((origen_calle=? AND origen_ciudad=?) OR (destino_calle=? AND destino_ciudad=?))').join(' OR ');
      statsWhere += ` AND (${sConds})`;
      userSucs.forEach(s => statsParams.push(s.calle, s.ciudad, s.calle, s.ciudad));
    }
    const [[stats]] = await db.query(
      `SELECT
         COUNT(*) as total,
         SUM(estado_actual = 'creado')      as creados,
         SUM(estado_actual = 'en-transito') as en_transito,
         SUM(estado_actual = 'entregado')   as entregados
       FROM envios ${statsWhere}`,
      statsParams
    );

    res.render('portal-cliente', {
      title: `Portal ${cliente.nombre_empresa}`,
      user: {
        nombre:   req.session.userName,
        email:    req.session.userEmail,
        rol:      req.session.userRole,
        clienteId
      },
      cliente,
      envios,
      stats,
      filtros: { buscar: buscar || '', estado: estado || 'todos', direccion_id: direccion_id || '' },
      direcciones,
      logoUrl,
      clienteLogoUrl: cliente.logo_url || null,
      sucursalLabel,
      paginacion: {
        actual:  pagina,
        total:   Math.ceil(total / porPagina),
        porPagina
      }
    });

  } catch (err) {
    console.error('Error portal cliente:', err);
    res.status(500).send('Error al cargar el portal');
  }
});

// ── GET /:id — Detalle de un envío (solo del propio cliente) ──
router.get('/envio/:id', soloCliente, async (req, res) => {
  try {
    const clienteId = req.session.clienteId;
    const { id }    = req.params;

    // Logo de la empresa
    const [[logoRowDet]] = await db.query(
      "SELECT valor FROM configuracion_sistema WHERE clave = 'empresa_logo_url'"
    );
    const logoUrl = logoRowDet?.valor || null;

    const [rows] = await db.query(
      `SELECT e.*, c.nombre_empresa, c.contacto, c.telefono
       FROM envios e
       LEFT JOIN clientes c ON e.cliente_id = c.id
       WHERE e.id = ? AND e.cliente_id = ?`,
      [id, clienteId]
    );

    if (rows.length === 0) {
      return res.redirect('/portal-cliente');
    }

    // Verificar acceso por sucursal(es)
    const [userSucsDet] = await db.query(
      `SELECT d.calle, d.ciudad FROM usuario_sucursales us
       JOIN direcciones_cliente d ON us.sucursal_dir_id = d.id
       WHERE us.usuario_id = ?`, [req.session.userId]
    );
    if (userSucsDet.length > 0) {
      const envio = rows[0];
      const ok = userSucsDet.some(s =>
        (envio.origen_calle === s.calle && envio.origen_ciudad === s.ciudad) ||
        (envio.destino_calle === s.calle && envio.destino_ciudad === s.ciudad)
      );
      if (!ok) return res.redirect('/portal-cliente');
    }


    const envio = rows[0];

    // ── Guías relacionadas (envíos parciales) ──
    let guiasRelacionadas = [];

    if (envio.es_parcial && !envio.es_complemento) {
      // Es raíz (PARTE 1) → traer todos sus complementos
      const [comps] = await db.query(
        `SELECT id, numero_tracking, estado_actual, numero_parte, es_complemento
         FROM envios
         WHERE envio_relacionado_id = ?
         ORDER BY numero_parte ASC`,
        [envio.id]
      );
      guiasRelacionadas = comps;

    } else if (envio.es_complemento && envio.envio_relacionado_id) {
      // Es complemento → traer la raíz y los hermanos
      const [raizRows] = await db.query(
        `SELECT id, numero_tracking, estado_actual, numero_parte, es_parcial, es_complemento
         FROM envios WHERE id = ?`,
        [envio.envio_relacionado_id]
      );
      const [hermanos] = await db.query(
        `SELECT id, numero_tracking, estado_actual, numero_parte, es_complemento
         FROM envios
         WHERE envio_relacionado_id = ? AND id != ?
         ORDER BY numero_parte ASC`,
        [envio.envio_relacionado_id, envio.id]
      );
      if (raizRows.length > 0) guiasRelacionadas = [raizRows[0], ...hermanos];
    }

    // Historial
    const [historial] = await db.query(
      `SELECT h.*, COALESCE(u.alias, u.nombre) as usuario_nombre
       FROM historial_estados h
       LEFT JOIN usuarios u ON h.usuario_id = u.id
       WHERE h.envio_id = ?
       ORDER BY h.fecha_hora ASC`,
      [id]
    );

    // Fotos
    for (const estado of historial) {
      const [fotos] = await db.query(
        'SELECT * FROM fotos_evidencia WHERE historial_estado_id = ?', [estado.id]
      );
      estado.fotos = fotos;
    }

    // Items
    const [items] = await db.query(
      'SELECT * FROM envio_items WHERE envio_id = ? ORDER BY id ASC', [id]
    );

    // Verificar si los documentos ya fueron generados por el operador
    const [[guiaDisponible]]    = await db.query('SELECT id FROM guias_config_impresa WHERE envio_id = ? AND activa = 1 AND (presentado_portal IS NULL OR presentado_portal = 1)', [id]);
    const [[etiquetaDisponible]] = await db.query('SELECT id FROM etiquetas_config_impresa WHERE envio_id = ? AND activa = 1 AND (presentado_portal IS NULL OR presentado_portal = 1)', [id]);

    const [[clienteDetRow]] = await db.query('SELECT logo_url, ocultar_fecha, ocultar_hora FROM clientes WHERE id = ?', [clienteId]);
    res.render('portal-cliente-detalle', {
      title: `Envío ${envio.numero_tracking}`,
      user: { nombre: req.session.userName, email: req.session.userEmail, rol: req.session.userRole },
      envio,
      historial,
      items,
      guiasRelacionadas,
      logoUrl,
      clienteLogoUrl: clienteDetRow?.logo_url || null,
      guiaDisponible: !!guiaDisponible,
      etiquetaDisponible: !!etiquetaDisponible,
      ocultarFecha: !!(clienteDetRow?.ocultar_fecha),
      ocultarHora:  !!(clienteDetRow?.ocultar_hora)
    });

  } catch (err) {
    console.error('Error detalle portal:', err);
    res.redirect('/portal-cliente');
  }
});

// ── GET /envio/:id/guia — Guía expedida (solo del propio cliente) ──
router.get('/envio/:id/guia', soloCliente, async (req, res) => {
  try {
    const clienteId = req.session.clienteId;
    const { id } = req.params;

    const [envios] = await db.query(`
      SELECT e.*,
        COALESCE(c.nombre_empresa, e.cliente_nombre, 'Sin cliente') as nombre_empresa,
        c.contacto, c.telefono, c.email as cliente_email, c.direccion as cliente_direccion
      FROM envios e
      LEFT JOIN clientes c ON e.cliente_id = c.id
      WHERE e.id = ? AND e.cliente_id = ?
    `, [id, clienteId]);

    if (envios.length === 0) return res.redirect('/portal-cliente');
    const envio = envios[0];

    // Verificar acceso por sucursal(es)
    const [userSucsGuia] = await db.query(
      `SELECT d.calle, d.ciudad FROM usuario_sucursales us
       JOIN direcciones_cliente d ON us.sucursal_dir_id = d.id
       WHERE us.usuario_id = ?`, [req.session.userId]
    );
    if (userSucsGuia.length > 0) {
      const ok = userSucsGuia.some(s =>
        (envio.origen_calle === s.calle && envio.origen_ciudad === s.ciudad) ||
        (envio.destino_calle === s.calle && envio.destino_ciudad === s.ciudad)
      );
      if (!ok) return res.redirect('/portal-cliente');
    }

    // Si el operador aún no ha imprimido la guía, mostrar mensaje
    const [[guiaGenerada]] = await db.query(
      'SELECT id FROM guias_config_impresa WHERE envio_id = ? AND activa = 1 AND (presentado_portal IS NULL OR presentado_portal = 1)', [id]
    );
    if (!guiaGenerada) return res.send(portalDocNoGenerado('Guía expedida', envio.numero_tracking, id));

    const [items] = await db.query('SELECT * FROM envio_items WHERE envio_id = ? ORDER BY id ASC', [id]);

    const [configs] = await db.query(
      "SELECT clave, valor FROM configuracion_sistema WHERE clave IN ('empresa_nombre','empresa_rfc','empresa_telefono','empresa_telefono_adicional','empresa_direccion','empresa_logo_url','empresa_sitio_web','empresa_aviso_privacidad','lugares_expedicion')"
    );
    const config = {};
    configs.forEach(c => { config[c.clave] = c.valor; });

    const lugaresExpedicion = (config.lugares_expedicion || '').split('\n').map(l => l.trim()).filter(Boolean);
    const lugarExpedicion = lugaresExpedicion.length >= 1 ? lugaresExpedicion[0] : '';

    // Template de guía del cliente
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
      descripcion_servicio:null, titulo_guia:null, mensaje_1:null, mensaje_2:null, mensaje_3:null, mensaje_4:null,
      etiqueta_col_descripcion:null, etiqueta_operador:null, etiqueta_obs_operador:null,
      etiqueta_recibido_por:null, etiqueta_obs_recibido:null,
      mostrar_obs_operador:1, obligatorio_obs_operador:0,
      mostrar_obs_recibido:1, obligatorio_obs_recibido:0,
      size_guia_titulo:null, size_tracking_big:null, size_company_name:null, size_seccion_content:null,
      size_cargo_td:null, size_guia_servicio:null, size_seccion_label:null, size_cargo_th:null,
      size_footer_content:null, size_pago_big:null, size_msg_row:null
    };
    let guiaCfg = { ...guiaCfgDefaults };
    const [[clienteGuia]] = await db.query('SELECT template_guia_id FROM clientes WHERE id = ?', [clienteId]);
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
        Object.keys(guiaCfgDefaults).filter(k => k.startsWith('obligatorio_')).forEach(k => {
          if (guiaCfg[k]) guiaCfg['mostrar_' + k.replace('obligatorio_', '')] = true;
        });
      }
    }

    let origenAlias = null;
    if (envio.origen_calle && envio.origen_ciudad) {
      const [origenRows] = await db.query(
        'SELECT alias FROM direcciones_empresa WHERE calle = ? AND ciudad = ? LIMIT 1',
        [envio.origen_calle, envio.origen_ciudad]
      );
      origenAlias = origenRows[0]?.alias || null;
      if (!origenAlias) {
        const [origenClienteRows] = await db.query(
          'SELECT alias FROM direcciones_cliente WHERE calle = ? AND ciudad = ? LIMIT 1',
          [envio.origen_calle, envio.origen_ciudad]
        );
        origenAlias = origenClienteRows[0]?.alias || null;
      }
    }
    let destinoAlias = null;
    if (envio.destino_calle && envio.destino_ciudad) {
      const [destinoRows] = await db.query(
        'SELECT alias FROM direcciones_cliente WHERE cliente_id = ? AND calle = ? AND ciudad = ? LIMIT 1',
        [clienteId, envio.destino_calle, envio.destino_ciudad]
      );
      destinoAlias = destinoRows[0]?.alias || null;
    }

    // Cargar config guardada al imprimir (estado de toggles del operador)
    const [[configImpresa]] = await db.query(
      'SELECT * FROM guias_config_impresa WHERE envio_id = ? AND activa = 1 AND (presentado_portal IS NULL OR presentado_portal = 1)', [id]
    );
    if (configImpresa) {
      Object.keys(guiaCfg).forEach(k => {
        if (k.startsWith('mostrar_') && configImpresa[k] !== undefined) {
          guiaCfg[k] = !!configImpresa[k];
        }
      });
    }

    // Log portal print
    db.query(
      `INSERT INTO impresiones_log (envio_id, tipo, usuario_id, usuario_nombre, tuvo_cambios, desde_portal) VALUES (?, 'guia', ?, ?, 0, 1)`,
      [id, req.session.userId, req.session.userName || 'Cliente']
    ).catch(() => {});

    res.render('envios/guia-expedida', {
      title: `Guía ${envio.numero_tracking}`,
      envio, items, config, guiaCfg, origenAlias, destinoAlias,
      lugaresExpedicion, lugarExpedicion,
      clienteView: true,
      user: { rol: req.session.userRole, id: req.session.userId }
    });

  } catch (err) {
    console.error('Error guia portal:', err);
    res.redirect('/portal-cliente');
  }
});

// ── GET /envio/:id/etiqueta — Etiqueta térmica (solo del propio cliente) ──
router.get('/envio/:id/etiqueta', soloCliente, async (req, res) => {
  try {
    const clienteId = req.session.clienteId;
    const { id } = req.params;
    const cantidad = req.query.cantidad || 1;

    const [envios] = await db.query(`
      SELECT e.*, c.nombre_empresa, c.contacto, c.telefono, c.direccion as cliente_direccion
      FROM envios e
      LEFT JOIN clientes c ON e.cliente_id = c.id
      WHERE e.id = ? AND e.cliente_id = ?
    `, [id, clienteId]);

    if (envios.length === 0) return res.redirect('/portal-cliente');
    const envioData = envios[0];

    // Verificar acceso por sucursal(es)
    const [userSucsEtq] = await db.query(
      `SELECT d.calle, d.ciudad FROM usuario_sucursales us
       JOIN direcciones_cliente d ON us.sucursal_dir_id = d.id
       WHERE us.usuario_id = ?`, [req.session.userId]
    );
    if (userSucsEtq.length > 0) {
      const ok = userSucsEtq.some(s =>
        (envioData.origen_calle === s.calle && envioData.origen_ciudad === s.ciudad) ||
        (envioData.destino_calle === s.calle && envioData.destino_ciudad === s.ciudad)
      );
      if (!ok) return res.redirect('/portal-cliente');
    }

    // Si el operador aún no ha imprimido la etiqueta, mostrar mensaje
    const [[etqGenerada]] = await db.query(
      'SELECT id FROM etiquetas_config_impresa WHERE envio_id = ? AND activa = 1 AND (presentado_portal IS NULL OR presentado_portal = 1)', [id]
    );
    if (!etqGenerada) return res.send(portalDocNoGenerado('Etiqueta', envioData.numero_tracking, id));

    let configuracion = {
      nombre_empresa:'TRANSPORTES AB', eslogan:'', telefono:'', email:'', sitio_web:'',
      telefono_adicional:'', logo_url:null, rfc:'', direccion:'',
      mostrar_logo:true, mostrar_eslogan:true, mostrar_telefono:true, mostrar_telefono_adicional:true,
      mostrar_email:true, mostrar_sitio_web:true, mostrar_rfc:true, mostrar_direccion_fiscal:true,
      mostrar_barcode:true, mostrar_qr:true, mostrar_ruta:true, mostrar_descripcion:true,
      obligatorio_logo:false, obligatorio_eslogan:false, obligatorio_telefono:false,
      obligatorio_telefono_adicional:false, obligatorio_email:false, obligatorio_sitio_web:false,
      obligatorio_rfc:false, obligatorio_direccion_fiscal:false, obligatorio_barcode:false,
      obligatorio_qr:false, obligatorio_ruta:false, obligatorio_descripcion:false
    };

    try {
      const [configRows] = await db.query("SELECT clave, valor FROM configuracion_sistema WHERE categoria IN ('empresa','etiqueta')");
      configRows.forEach(item => {
        switch(item.clave) {
          case 'empresa_nombre':             configuracion.nombre_empresa     = item.valor || 'TRANSPORTES AB'; break;
          case 'empresa_eslogan':            configuracion.eslogan            = item.valor || ''; break;
          case 'empresa_telefono':           configuracion.telefono           = item.valor || ''; break;
          case 'empresa_telefono_adicional': configuracion.telefono_adicional = item.valor || ''; break;
          case 'empresa_email':              configuracion.email              = item.valor || ''; break;
          case 'empresa_sitio_web':          configuracion.sitio_web          = item.valor || ''; break;
          case 'empresa_logo_url':           configuracion.logo_url           = item.valor || null; break;
          case 'empresa_logo_bw_url':        configuracion.logo_bw_url        = item.valor || null; break;
          case 'empresa_rfc':                configuracion.rfc                = item.valor || ''; break;
          case 'empresa_direccion':          configuracion.direccion          = item.valor || ''; break;
        }
      });

      const [[clienteRow]] = await db.query('SELECT template_etiqueta_id FROM clientes WHERE id = ?', [clienteId]);
      if (clienteRow && clienteRow.template_etiqueta_id) {
        const [[tpl]] = await db.query('SELECT * FROM etiqueta_templates WHERE id = ?', [clienteRow.template_etiqueta_id]);
        if (tpl) {
          const keys = ['logo','eslogan','telefono','telefono_adicional','email','sitio_web','rfc','direccion_fiscal','barcode','qr','ruta','descripcion','dest_contacto','dest_telefono','dest_nombre','dest_direccion','dest_referencia','alias_ruta','peso_total','peso_item'];
          keys.forEach(k => {
            configuracion['mostrar_' + k]    = !!tpl['mostrar_' + k];
            configuracion['obligatorio_' + k] = !!tpl['obligatorio_' + k];
            if (configuracion['obligatorio_' + k]) configuracion['mostrar_' + k] = true;
          });
          const textKeys = ['texto_entregar_a','texto_peso','texto_peso_item','texto_entrega_estimada','texto_ref_cliente','texto_descripcion','texto_fecha_emision','texto_etiqueta'];
          textKeys.forEach(k => { if (tpl[k]) configuracion[k] = tpl[k]; });
          const sizeKeys = ['size_tracking','size_ruta_ciudad','size_dest_nombre','size_dest_direccion','size_empresa_nombre','size_eslogan','size_tipo_servicio','size_detalle_valor','size_descripcion','size_dest_contacto','size_barra_contacto','size_ruta_etiqueta','size_detalle_etiqueta','size_cab_fecha','size_cab_num'];
          sizeKeys.forEach(k => { if (tpl[k]) configuracion[k] = tpl[k]; });
        }
      }
    } catch (e) { /* usar defaults */ }

    const [itemsEtiq] = await db.query('SELECT * FROM envio_items WHERE envio_id = ? ORDER BY id ASC', [id]);

    let guiasRelEtiq = [];
    if (envioData.es_parcial) {
      const [comps] = await db.query('SELECT id FROM envios WHERE envio_relacionado_id = ? ORDER BY numero_parte ASC', [id]);
      guiasRelEtiq = comps;
    } else if (envioData.es_complemento && envioData.envio_relacionado_id) {
      const [comps] = await db.query('SELECT id FROM envios WHERE envio_relacionado_id = ? ORDER BY numero_parte ASC', [envioData.envio_relacionado_id]);
      guiasRelEtiq = comps;
    }

    let origenAliasEtq = null;
    if (envioData.origen_calle && envioData.origen_ciudad) {
      const [r] = await db.query('SELECT alias FROM direcciones_empresa WHERE calle = ? AND ciudad = ? LIMIT 1', [envioData.origen_calle, envioData.origen_ciudad]);
      origenAliasEtq = r[0]?.alias || null;
    }
    let destinoAliasEtq = null;
    if (envioData.destino_calle && envioData.destino_ciudad) {
      const [r] = await db.query('SELECT alias FROM direcciones_cliente WHERE cliente_id = ? AND calle = ? AND ciudad = ? LIMIT 1', [clienteId, envioData.destino_calle, envioData.destino_ciudad]);
      destinoAliasEtq = r[0]?.alias || null;
    }

    const [pictosEnvio] = await db.query(`
      SELECT p.id, p.nombre, p.imagen_url FROM envio_pictogramas ep
      JOIN pictogramas p ON p.id = ep.pictograma_id
      WHERE ep.envio_id = ? AND p.activo = 1 ORDER BY p.orden ASC, p.nombre ASC
    `, [id]).catch(() => [[]]);

    // Cargar config guardada al imprimir (estado de toggles del operador)
    const [[etqConfigImpresa]] = await db.query(
      'SELECT * FROM etiquetas_config_impresa WHERE envio_id = ? AND activa = 1 AND (presentado_portal IS NULL OR presentado_portal = 1)', [id]
    );
    if (etqConfigImpresa) {
      const keyMap = {
        logo:'logo', eslogan:'eslogan', telefono:'telefono', telefono_adicional:'telefono_adicional',
        email:'email', sitio_web:'sitio_web', rfc:'rfc', direccion_fiscal:'direccion_fiscal',
        barcode:'barcode', qr:'qr', ruta:'ruta', descripcion:'descripcion',
        dest_nombre:'dest_nombre', dest_direccion:'dest_direccion', dest_referencia:'dest_referencia',
        dest_contacto:'dest_contacto', dest_telefono:'dest_telefono',
        alias_ruta:'alias_ruta', peso_total:'peso_total', peso_item:'peso_item'
      };
      Object.keys(keyMap).forEach(col => {
        if (etqConfigImpresa['mostrar_' + col] !== undefined) {
          configuracion['mostrar_' + keyMap[col]] = !!etqConfigImpresa['mostrar_' + col];
        }
      });
    }

    // Log portal print
    db.query(
      `INSERT INTO impresiones_log (envio_id, tipo, usuario_id, usuario_nombre, tuvo_cambios, desde_portal) VALUES (?, 'etiqueta', ?, ?, 0, 1)`,
      [id, req.session.userId, req.session.userName || 'Cliente']
    ).catch(() => {});

    res.render('envios/etiquetaT', {
      title: 'Etiqueta de Envío',
      envio: envioData, cantidad: parseInt(cantidad),
      baseUrl: `${req.protocol}://${req.get('host')}`,
      configuracion, items: itemsEtiq, guiasRelacionadas: guiasRelEtiq,
      pictogramas: pictosEnvio || [],
      origenAlias: origenAliasEtq, destinoAlias: destinoAliasEtq,
      clienteView: true,
      user: { nombre: req.session.userName, email: req.session.userEmail, rol: req.session.userRole }
    });

  } catch (err) {
    console.error('Error etiqueta portal:', err);
    res.redirect('/portal-cliente');
  }
});

// ── POST /logo — El cliente sube su propio logo ───────────────
router.post('/logo', soloCliente, uploadClienteLogo.single('logo'), async (req, res) => {
  try {
    const clienteId = req.session.clienteId;
    if (!clienteId) return res.redirect('/auth/logout');
    if (!req.file) return res.redirect('/portal-cliente?logoError=1');

    // Borrar logo anterior si existe
    const [[clienteRow]] = await db.query('SELECT logo_url FROM clientes WHERE id = ?', [clienteId]);
    if (clienteRow?.logo_url) {
      const oldPath = path.join('public', clienteRow.logo_url.replace(/^\//, ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const logoUrl = '/uploads/clientes/' + req.file.filename;
    await db.query('UPDATE clientes SET logo_url = ? WHERE id = ?', [logoUrl, clienteId]);
    res.redirect('/portal-cliente');
  } catch (err) {
    console.error('Error subiendo logo cliente:', err);
    res.redirect('/portal-cliente');
  }
});

module.exports = router;