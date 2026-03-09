const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const { isAuthenticated } = require('../middleware/auth');
const { requireCliente }  = require('../middleware/roles');

// Middleware combinado: autenticado + rol cliente
const soloCliente = [isAuthenticated, requireCliente];

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
        cliente: cliente || { nombre_empresa: 'Cliente' },
        portalDeshabilitado: true,
        envios: [], totalEnvios: 0, totalPaginas: 0, pagina: 1,
        resumen: { total: 0, creados: 0, en_transito: 0, entregados: 0 },
        direcciones: [], filtros: {}, logoUrl: logoUrl || null
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

    // Query de envíos
    let where  = 'WHERE e.cliente_id = ?';
    const params = [clienteId];

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

    // Stats rápidas
    const [[stats]] = await db.query(
      `SELECT
         COUNT(*) as total,
         SUM(estado_actual = 'creado')      as creados,
         SUM(estado_actual = 'en-transito') as en_transito,
         SUM(estado_actual = 'entregado')   as entregados
       FROM envios WHERE cliente_id = ?`,
      [clienteId]
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

    res.render('portal-cliente-detalle', {
      title: `Envío ${envio.numero_tracking}`,
      user: { nombre: req.session.userName, email: req.session.userEmail, rol: req.session.userRole },
      envio,
      historial,
      items,
      guiasRelacionadas,
      logoUrl
    });

  } catch (err) {
    console.error('Error detalle portal:', err);
    res.redirect('/portal-cliente');
  }
});

module.exports = router;