const express = require('express');
const router = express.Router();
const db = require('../config/database');
const ExcelJS = require('exceljs');

// Middleware de autenticación
function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.redirect('/auth/login');
}

// ==================== PÁGINA PRINCIPAL ====================
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, estado } = req.query;
    
    // Estadísticas generales
    const [stats] = await db.query(`
      SELECT 
        COUNT(*) as total_envios,
        SUM(CASE WHEN estado_actual = 'entregado' THEN 1 ELSE 0 END) as entregados,
        SUM(CASE WHEN estado_actual = 'en-transito' OR estado_actual = 'en_transito' THEN 1 ELSE 0 END) as en_transito
      FROM envios
    `);
    
    const [clientesActivos] = await db.query('SELECT COUNT(*) as total FROM clientes WHERE activo = 1 AND eliminado_en IS NULL');
    
    const [enviosRetrasados] = await db.query(`
      SELECT COUNT(*) as total 
      FROM envios 
      WHERE estado_actual NOT IN ('entregado', 'cancelado')
      AND fecha_estimada_entrega < CURDATE()
    `);
    
    res.render('reportes/index', {
      title: 'Reportes',
      user: {
        id: req.session.userId,
        nombre: req.session.userName,
        email: req.session.userEmail,
        rol: req.session.userRole
      },
      totalEnvios: stats[0].total_envios,
      entregados: stats[0].entregados,
      enTransito: stats[0].en_transito,
      clientesActivos: clientesActivos[0].total,
      enviosRetrasados: enviosRetrasados[0].total,
      filtros: { fecha_inicio, fecha_fin, estado }
    });
  } catch (error) {
    console.error('Error al cargar reportes:', error);
    res.status(500).send('Error al cargar los reportes');
  }
});

// ==================== REPORTE GENERAL ====================
router.get('/general', isAuthenticated, async (req, res) => {
  try {
    // Obtener todos los envíos con información completa
    const [envios] = await db.query(`
      SELECT 
        e.*,
        COALESCE(c.nombre_empresa, e.cliente_nombre, 'Sin cliente') as nombre_empresa,
        c.contacto,
        u.nombre as creador_nombre
      FROM envios e
      LEFT JOIN clientes c ON e.cliente_id = c.id
      LEFT JOIN usuarios u ON e.usuario_creador_id = u.id
      ORDER BY e.fecha_creacion DESC
    `);
    
    // Estadísticas por estado
    const [estadisticas] = await db.query(`
      SELECT 
        estado_actual,
        COUNT(*) as total
      FROM envios
      GROUP BY estado_actual
    `);
    
    // Envíos por mes (últimos 6 meses)
    const [porMes] = await db.query(`
      SELECT 
        DATE_FORMAT(fecha_creacion, '%Y-%m') as mes,
        COUNT(*) as total
      FROM envios
      WHERE fecha_creacion >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(fecha_creacion, '%Y-%m')
      ORDER BY mes DESC
    `);
    
    const [enviosRetrasados] = await db.query(`
      SELECT COUNT(*) as total 
      FROM envios 
      WHERE estado_actual NOT IN ('entregado', 'cancelado')
      AND fecha_estimada_entrega < CURDATE()
    `);
    
    res.render('reportes/general', {
      title: 'Reporte General',
      user: {
        id: req.session.userId,
        nombre: req.session.userName,
        email: req.session.userEmail,
        rol: req.session.userRole
      },
      envios,
      estadisticas,
      porMes,
      enviosRetrasados: enviosRetrasados[0].total
    });
  } catch (error) {
    console.error('Error al generar reporte general:', error);
    res.status(500).send('Error al generar el reporte');
  }
});

// ==================== REPORTE POR CLIENTE ====================
router.get('/clientes', isAuthenticated, async (req, res) => {
  try {
    // Envíos agrupados por cliente
    const [clientesConEnvios] = await db.query(`
      SELECT 
        c.id,
        c.nombre_empresa,
        c.contacto,
        c.email,
        c.telefono,
        COUNT(e.id) as total_envios,
        SUM(CASE WHEN e.estado_actual = 'entregado' THEN 1 ELSE 0 END) as entregados,
        SUM(CASE WHEN e.estado_actual = 'en-transito' OR e.estado_actual = 'en_transito' THEN 1 ELSE 0 END) as en_transito,
        SUM(CASE WHEN e.estado_actual = 'cancelado' THEN 1 ELSE 0 END) as cancelados,
        MIN(e.fecha_creacion) as primer_envio,
        MAX(e.fecha_creacion) as ultimo_envio
      FROM clientes c
      LEFT JOIN envios e ON c.id = e.cliente_id
      WHERE c.activo = 1 AND c.eliminado_en IS NULL
      GROUP BY c.id
      ORDER BY total_envios DESC
    `);
    
    const [enviosRetrasados] = await db.query(`
      SELECT COUNT(*) as total 
      FROM envios 
      WHERE estado_actual NOT IN ('entregado', 'cancelado')
      AND fecha_estimada_entrega < CURDATE()
    `);
    
    res.render('reportes/clientes', {
      title: 'Reporte por Cliente',
      user: {
        id: req.session.userId,
        nombre: req.session.userName,
        email: req.session.userEmail,
        rol: req.session.userRole
      },
      clientes: clientesConEnvios,
      enviosRetrasados: enviosRetrasados[0].total
    });
  } catch (error) {
    console.error('Error al generar reporte por cliente:', error);
    res.status(500).send('Error al generar el reporte');
  }
});

// ==================== REPORTE POR PERÍODO ====================
router.get('/periodo', isAuthenticated, async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    
    let whereClause = '1=1';
    const params = [];
    
    if (fecha_inicio) {
      whereClause += ' AND DATE(e.fecha_creacion) >= ?';
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      whereClause += ' AND DATE(e.fecha_creacion) <= ?';
      params.push(fecha_fin);
    }
    
    // Envíos del período
    const [envios] = await db.query(`
      SELECT 
        e.*,
        COALESCE(c.nombre_empresa, e.cliente_nombre, 'Sin cliente') as nombre_empresa,
        c.contacto
      FROM envios e
      LEFT JOIN clientes c ON e.cliente_id = c.id
      WHERE ${whereClause}
      ORDER BY e.fecha_creacion DESC
    `, params);
    
    // Estadísticas del período
    const [estadisticas] = await db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN estado_actual = 'entregado' THEN 1 ELSE 0 END) as entregados,
        SUM(CASE WHEN estado_actual = 'en-transito' OR estado_actual = 'en_transito' THEN 1 ELSE 0 END) as en_transito,
        SUM(CASE WHEN estado_actual = 'cancelado' THEN 1 ELSE 0 END) as cancelados
      FROM envios e
      WHERE ${whereClause}
    `, params);
    
    // Envíos por día del período
    const [porDia] = await db.query(`
      SELECT 
        DATE(fecha_creacion) as fecha,
        COUNT(*) as total
      FROM envios e
      WHERE ${whereClause}
      GROUP BY DATE(fecha_creacion)
      ORDER BY fecha DESC
    `, params);
    
    const [enviosRetrasados] = await db.query(`
      SELECT COUNT(*) as total 
      FROM envios 
      WHERE estado_actual NOT IN ('entregado', 'cancelado')
      AND fecha_estimada_entrega < CURDATE()
    `);
    
    res.render('reportes/periodo', {
      title: 'Reporte por Período',
      user: {
        id: req.session.userId,
        nombre: req.session.userName,
        email: req.session.userEmail,
        rol: req.session.userRole
      },
      envios,
      estadisticas: estadisticas[0],
      porDia,
      filtros: { fecha_inicio, fecha_fin },
      enviosRetrasados: enviosRetrasados[0].total
    });
  } catch (error) {
    console.error('Error al generar reporte por período:', error);
    res.status(500).send('Error al generar el reporte');
  }
});

// ==================== REPORTE DE RENDIMIENTO ====================
router.get('/rendimiento', isAuthenticated, async (req, res) => {
  try {
    // Tiempo promedio de entrega
    const [tiempoPromedio] = await db.query(`
      SELECT 
        AVG(DATEDIFF(
          COALESCE(
            (SELECT fecha_hora FROM historial_estados 
             WHERE envio_id = e.id AND estado = 'entregado' 
             ORDER BY fecha_hora DESC LIMIT 1),
            NOW()
          ),
          e.fecha_creacion
        )) as promedio_dias
      FROM envios e
      WHERE e.estado_actual = 'entregado'
    `);
    
    // Eficiencia por estado
    const [eficiencia] = await db.query(`
      SELECT 
        estado_actual,
        COUNT(*) as total,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM envios), 2) as porcentaje
      FROM envios
      GROUP BY estado_actual
      ORDER BY total DESC
    `);
    
    // Top 5 clientes por volumen
    const [topClientes] = await db.query(`
      SELECT 
        COALESCE(c.nombre_empresa, 'Sin cliente') as nombre_empresa,
        COUNT(e.id) as total_envios,
        SUM(CASE WHEN e.estado_actual = 'entregado' THEN 1 ELSE 0 END) as entregados
      FROM clientes c
      LEFT JOIN envios e ON c.id = e.cliente_id
      WHERE c.activo = 1 AND c.eliminado_en IS NULL
      GROUP BY c.id
      ORDER BY total_envios DESC
      LIMIT 5
    `);
    
    // Envíos retrasados
    const [retrasados] = await db.query(`
      SELECT 
        e.*,
        COALESCE(c.nombre_empresa, e.cliente_nombre, 'Sin cliente') as nombre_empresa,
        DATEDIFF(CURDATE(), DATE(e.fecha_estimada_entrega)) as dias_retraso
      FROM envios e
      LEFT JOIN clientes c ON e.cliente_id = c.id
      WHERE e.estado_actual NOT IN ('entregado', 'cancelado')
      AND e.fecha_estimada_entrega < CURDATE()
      ORDER BY dias_retraso DESC
    `);
    
    // Tendencia últimos 30 días
    const [tendencia] = await db.query(`
      SELECT 
        DATE(fecha_creacion) as fecha,
        COUNT(*) as total,
        SUM(CASE WHEN estado_actual = 'entregado' THEN 1 ELSE 0 END) as entregados
      FROM envios
      WHERE fecha_creacion >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(fecha_creacion)
      ORDER BY fecha ASC
    `);
    
    const [enviosRetrasados] = await db.query(`
      SELECT COUNT(*) as total 
      FROM envios 
      WHERE estado_actual NOT IN ('entregado', 'cancelado')
      AND fecha_estimada_entrega < CURDATE()
    `);
    
    res.render('reportes/rendimiento', {
      title: 'Reporte de Rendimiento',
      user: {
        id: req.session.userId,
        nombre: req.session.userName,
        email: req.session.userEmail,
        rol: req.session.userRole
      },
      tiempoPromedio: tiempoPromedio[0].promedio_dias || 0,
      eficiencia,
      topClientes,
      retrasados,
      tendencia,
      enviosRetrasados: enviosRetrasados[0].total
    });
  } catch (error) {
    console.error('Error al generar reporte de rendimiento:', error);
    res.status(500).send('Error al generar el reporte');
  }
});

// ══════════════════════════════════════════════════════════════
// HELPERS EXPORT
// ══════════════════════════════════════════════════════════════
function fmtFecha(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtEstado(e) {
  return (e || 'creado').replace(/_/g, ' ').replace(/-/g, ' ').toUpperCase();
}

const COL = {
  AZUL:       'FF1E3A8A',
  AZUL_LIGHT: 'FFdbeafe',
  AZUL_MID:   'FF3b5fc0',
  GRIS_CLARO: 'FFF8F9FA',
  BLANCO:     'FFFFFFFF',
  FILA_ALT:   'FFF0F5FF',
  VERDE_BG:   'FFD1FAE5',
  VERDE_FG:   'FF065F46',
  NARANJA_BG: 'FFFFF3C7',
  NARANJA_FG: 'FF92400E',
  ROJO_BG:    'FFFEE2E2',
  ROJO_FG:    'FF991B1B',
  GRIS_TEXTO: 'FF6B7280',
};

function xlsxHeader(ws, titulo, subtitulo, ncols) {
  const colLetter = String.fromCharCode(64 + ncols);
  // Fila 1 — empresa
  ws.mergeCells(`A1:${colLetter}1`);
  const e1 = ws.getCell('A1');
  e1.value = 'TRANSPORTES AB';
  e1.font  = { name: 'Calibri', size: 18, bold: true, color: { argb: COL.BLANCO } };
  e1.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: COL.AZUL } };
  e1.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 40;
  // Fila 2 — título
  ws.mergeCells(`A2:${colLetter}2`);
  const e2 = ws.getCell('A2');
  e2.value = titulo;
  e2.font  = { name: 'Calibri', size: 13, bold: true, color: { argb: COL.AZUL } };
  e2.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: COL.AZUL_LIGHT } };
  e2.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 28;
  // Fila 3 — subtítulo / descripción
  if (subtitulo) {
    ws.mergeCells(`A3:${colLetter}3`);
    const e3 = ws.getCell('A3');
    e3.value = subtitulo;
    e3.font  = { name: 'Calibri', size: 10, italic: true, color: { argb: COL.GRIS_TEXTO } };
    e3.alignment = { horizontal: 'center' };
    ws.getRow(3).height = 18;
  }
  // Fila 4 — fecha generación
  const filaFecha = subtitulo ? 4 : 3;
  ws.mergeCells(`A${filaFecha}:${colLetter}${filaFecha}`);
  const ef = ws.getCell(`A${filaFecha}`);
  ef.value = 'Generado el ' + new Date().toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  ef.font  = { name: 'Calibri', size: 9, italic: true, color: { argb: COL.GRIS_TEXTO } };
  ef.alignment = { horizontal: 'center' };
  ws.getRow(filaFecha).height = 16;
  // Fila 5 — espaciado
  ws.getRow(subtitulo ? 5 : 4).height = 8;
  return subtitulo ? 6 : 5; // primera fila disponible para datos
}

function xlsxColHeader(row) {
  row.eachCell(cell => {
    cell.font  = { name: 'Calibri', size: 11, bold: true, color: { argb: COL.BLANCO } };
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: COL.AZUL_MID } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
    cell.border = { bottom: { style: 'medium', color: { argb: COL.BLANCO } } };
  });
  row.height = 28;
}

function xlsxDataRow(row, idx) {
  const bg = idx % 2 === 0 ? COL.BLANCO : COL.FILA_ALT;
  row.eachCell({ includeEmpty: true }, cell => {
    if (!cell.fill || cell.fill.fgColor?.argb === undefined || [COL.VERDE_BG, COL.NARANJA_BG, COL.ROJO_BG].includes(cell.fill.fgColor?.argb)) return;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  });
  row.eachCell(cell => {
    if (!cell.font?.color) cell.font = { ...(cell.font || {}), name: 'Calibri', size: 10 };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
    if (!cell.alignment) cell.alignment = { vertical: 'middle' };
  });
  row.height = 22;
}

function xlsxDataRowColored(row, idx, estadoVal) {
  // fondo alternado base
  const bgBase = idx % 2 === 0 ? COL.BLANCO : COL.FILA_ALT;
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgBase } };
    cell.font = { name: 'Calibri', size: 10 };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
    cell.alignment = { vertical: 'middle' };
  });
  row.height = 22;
}

function xlsxTotales(row) {
  row.eachCell(cell => {
    cell.font  = { name: 'Calibri', size: 11, bold: true, color: { argb: COL.BLANCO } };
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: COL.AZUL } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  row.height = 26;
}

function colorEstadoCell(cell, estado) {
  if (!estado) return;
  const e = estado.toLowerCase();
  if (e === 'entregado') {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COL.VERDE_BG } };
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COL.VERDE_FG } };
  } else if (e === 'cancelado') {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COL.ROJO_BG } };
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COL.ROJO_FG } };
  } else if (e.includes('transito')) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COL.NARANJA_BG } };
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COL.NARANJA_FG } };
  }
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
}

function enviarExcel(res, wb, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return wb.xlsx.write(res);
}

// CSS compartido para PDFs
const PDF_CSS = `
  @page { size: A4 landscape; margin: 12mm 10mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; font-size:11px; color:#1f2937; background:#fff; }
  .print-btn { position:fixed; top:12px; right:12px; padding:9px 20px; background:#1e3a8a; color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,.25); z-index:999; }
  .print-btn:hover { background:#1d4ed8; }
  .encabezado { background:linear-gradient(135deg,#1e3a8a,#2563eb); color:#fff; padding:14px 20px 12px; border-radius:10px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; }
  .enc-empresa { font-size:11px; font-weight:600; opacity:.75; margin-bottom:3px; text-transform:uppercase; letter-spacing:.5px; }
  .enc-titulo  { font-size:20px; font-weight:900; line-height:1.1; }
  .enc-sub     { font-size:11px; opacity:.8; margin-top:4px; }
  .enc-fecha   { font-size:10px; opacity:.7; text-align:right; }
  .stats-grid  { display:grid; gap:10px; margin-bottom:14px; }
  .stat-card   { border-radius:8px; padding:10px 14px; text-align:center; }
  .stat-n { font-size:24px; font-weight:900; line-height:1; }
  .stat-l { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; margin-top:3px; opacity:.85; }
  .s-azul   { background:#dbeafe; color:#1e40af; }
  .s-verde  { background:#d1fae5; color:#065f46; }
  .s-naranja{ background:#fef3c7; color:#92400e; }
  .s-rojo   { background:#fee2e2; color:#991b1b; }
  .s-gris   { background:#f3f4f6; color:#374151; }
  .seccion-titulo { font-size:13px; font-weight:800; color:#1e3a8a; margin:14px 0 8px; padding-bottom:5px; border-bottom:2px solid #1e3a8a; }
  table { width:100%; border-collapse:collapse; }
  thead tr { background:#1e3a8a; }
  th { padding:8px 10px; color:#fff; text-align:left; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; white-space:nowrap; }
  th.c { text-align:center; }
  td { padding:6px 10px; border-bottom:1px solid #f0f0f0; }
  td.c { text-align:center; }
  tr.par  { background:#ffffff; }
  tr.impar{ background:#f6f8ff; }
  .track { font-family:monospace; font-size:10px; font-weight:700; color:#1e40af; }
  .badge { display:inline-block; padding:2px 8px; border-radius:4px; font-size:10px; font-weight:700; }
  .b-verde  { background:#d1fae5; color:#065f46; }
  .b-naranja{ background:#fef3c7; color:#92400e; }
  .b-rojo   { background:#fee2e2; color:#991b1b; }
  .b-gris   { background:#f3f4f6; color:#374151; }
  .footer { margin-top:14px; text-align:center; font-size:9px; color:#9ca3af; padding-top:8px; border-top:1px solid #e5e7eb; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  @media print { .print-btn { display:none !important; } body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
`;

function badgeEstado(e) {
  const s = (e || 'creado').toLowerCase();
  const cls = s === 'entregado' ? 'verde' : s === 'cancelado' ? 'rojo' : s.includes('transito') ? 'naranja' : 'gris';
  return `<span class="badge b-${cls}">${fmtEstado(e)}</span>`;
}

function pdfEncabezado(titulo, subtitulo, fecha) {
  return `<div class="encabezado">
    <div>
      <div class="enc-empresa">Transportes AB</div>
      <div class="enc-titulo">${titulo}</div>
      ${subtitulo ? `<div class="enc-sub">${subtitulo}</div>` : ''}
    </div>
    <div class="enc-fecha">Generado el<br>${fecha}</div>
  </div>`;
}

// ══════════════════════════════════════════════════════════════
// EXCEL — GENERAL
// ══════════════════════════════════════════════════════════════
router.get('/general/excel', isAuthenticated, async (req, res) => {
  try {
    const [envios] = await db.query(`
      SELECT e.numero_tracking,
        COALESCE(c.nombre_empresa, e.cliente_nombre, 'Sin cliente') as nombre_empresa,
        e.origen, e.destino, e.estado_actual, e.peso,
        e.fecha_creacion, e.fecha_estimada_entrega, u.nombre as creador_nombre
      FROM envios e
      LEFT JOIN clientes c ON e.cliente_id = c.id
      LEFT JOIN usuarios u ON e.usuario_creador_id = u.id
      ORDER BY e.fecha_creacion DESC
    `);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Transportes AB'; wb.created = new Date();
    const ws = wb.addWorksheet('Reporte General');

    ws.columns = [
      { key: 'a', width: 22 }, { key: 'b', width: 28 }, { key: 'c', width: 34 },
      { key: 'd', width: 34 }, { key: 'e', width: 20 }, { key: 'f', width: 12 },
      { key: 'g', width: 18 }, { key: 'h', width: 18 }, { key: 'i', width: 22 },
    ];

    xlsxHeader(ws, 'Reporte General de Envíos', `Total: ${envios.length} envíos registrados`, 9);

    const hRow = ws.addRow(['N° Tracking', 'Cliente', 'Origen', 'Destino', 'Estado', 'Peso (kg)', 'Fecha Creación', 'Entrega Estimada', 'Creado Por']);
    xlsxColHeader(hRow);

    let ent = 0, tr = 0, can = 0;
    envios.forEach((e, i) => {
      const row = ws.addRow([
        e.numero_tracking, e.nombre_empresa || '—', e.origen || '—', e.destino || '—',
        fmtEstado(e.estado_actual), e.peso ? parseFloat(e.peso) : '—',
        fmtFecha(e.fecha_creacion), fmtFecha(e.fecha_estimada_entrega), e.creador_nombre || 'Sistema'
      ]);
      xlsxDataRowColored(row, i, e.estado_actual);
      colorEstadoCell(row.getCell(5), e.estado_actual);
      if (e.estado_actual === 'entregado') ent++;
      else if (e.estado_actual === 'cancelado') can++;
      else if ((e.estado_actual || '').includes('transito')) tr++;
    });

    ws.addRow([]);
    const tRow = ws.addRow([`TOTAL: ${envios.length} envíos`, '', '', '', `✔ Entregados: ${ent}`, '', `↑ En Tránsito: ${tr}`, `✖ Cancelados: ${can}`, '']);
    xlsxTotales(tRow);

    await enviarExcel(res, wb, `reporte-general-${new Date().toISOString().slice(0,10)}.xlsx`);
  } catch (err) {
    console.error('Excel general:', err);
    res.status(500).send('Error al generar Excel');
  }
});

// ══════════════════════════════════════════════════════════════
// PDF — GENERAL
// ══════════════════════════════════════════════════════════════
router.get('/general/pdf', isAuthenticated, async (req, res) => {
  try {
    const [envios] = await db.query(`
      SELECT e.numero_tracking,
        COALESCE(c.nombre_empresa, e.cliente_nombre, 'Sin cliente') as nombre_empresa,
        e.origen, e.destino, e.estado_actual, e.peso, e.fecha_creacion
      FROM envios e
      LEFT JOIN clientes c ON e.cliente_id = c.id
      ORDER BY e.fecha_creacion DESC
    `);
    const ent = envios.filter(e => e.estado_actual === 'entregado').length;
    const can = envios.filter(e => e.estado_actual === 'cancelado').length;
    const tr  = envios.filter(e => (e.estado_actual || '').includes('transito')).length;
    const fecha = new Date().toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' });

    const filas = envios.map((e, i) => `
      <tr class="${i%2===0?'par':'impar'}">
        <td><span class="track">${e.numero_tracking}</span></td>
        <td>${e.nombre_empresa || '—'}</td>
        <td style="font-size:10px;">${(e.origen||'—').substring(0,38)}</td>
        <td style="font-size:10px;">${(e.destino||'—').substring(0,38)}</td>
        <td class="c">${badgeEstado(e.estado_actual)}</td>
        <td class="c">${e.peso || '—'}</td>
        <td class="c">${fmtFecha(e.fecha_creacion)}</td>
      </tr>`).join('');

    res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Reporte General — Transportes AB</title>
<style>${PDF_CSS}</style></head><body>
<button class="print-btn" onclick="window.print()">🖨️ Guardar PDF</button>
${pdfEncabezado('Reporte General de Envíos', `${envios.length} envíos registrados`, fecha)}
<div class="stats-grid" style="grid-template-columns:repeat(4,1fr);">
  <div class="stat-card s-azul"><div class="stat-n">${envios.length}</div><div class="stat-l">Total Envíos</div></div>
  <div class="stat-card s-verde"><div class="stat-n">${ent}</div><div class="stat-l">Entregados</div></div>
  <div class="stat-card s-naranja"><div class="stat-n">${tr}</div><div class="stat-l">En Tránsito</div></div>
  <div class="stat-card s-rojo"><div class="stat-n">${can}</div><div class="stat-l">Cancelados</div></div>
</div>
<table><thead><tr>
  <th>N° Tracking</th><th>Cliente</th><th>Origen</th><th>Destino</th>
  <th class="c">Estado</th><th class="c">Peso kg</th><th class="c">Fecha</th>
</tr></thead><tbody>${filas}</tbody></table>
<div class="footer">Transportes AB · Sistema de Rastreo · ${fecha}</div>
</body></html>`);
  } catch (err) {
    console.error('PDF general:', err);
    res.status(500).send('Error al generar PDF');
  }
});

// ══════════════════════════════════════════════════════════════
// EXCEL — CLIENTES
// ══════════════════════════════════════════════════════════════
router.get('/clientes/excel', isAuthenticated, async (req, res) => {
  try {
    const [clientes] = await db.query(`
      SELECT c.nombre_empresa, c.contacto, c.email, c.telefono,
        COUNT(e.id) as total_envios,
        SUM(CASE WHEN e.estado_actual='entregado' THEN 1 ELSE 0 END) as entregados,
        SUM(CASE WHEN e.estado_actual IN ('en-transito','en_transito') THEN 1 ELSE 0 END) as en_transito,
        SUM(CASE WHEN e.estado_actual='cancelado' THEN 1 ELSE 0 END) as cancelados,
        MIN(e.fecha_creacion) as primer_envio, MAX(e.fecha_creacion) as ultimo_envio
      FROM clientes c
      LEFT JOIN envios e ON c.id = e.cliente_id
      WHERE c.activo = 1 AND c.eliminado_en IS NULL
      GROUP BY c.id ORDER BY total_envios DESC
    `);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Transportes AB'; wb.created = new Date();
    const ws = wb.addWorksheet('Clientes');

    ws.columns = [
      {key:'a',width:30},{key:'b',width:24},{key:'c',width:30},{key:'d',width:18},
      {key:'e',width:12},{key:'f',width:14},{key:'g',width:14},{key:'h',width:14},
      {key:'i',width:20},{key:'j',width:20},
    ];

    xlsxHeader(ws, 'Reporte por Cliente', `${clientes.length} clientes activos`, 10);
    const hRow = ws.addRow(['Empresa','Contacto','Email','Teléfono','Total','Entregados','En Tránsito','Cancelados','Primer Envío','Último Envío']);
    xlsxColHeader(hRow);

    let totT=0, totE=0, totTr=0, totC=0;
    clientes.forEach((c, i) => {
      const row = ws.addRow([
        c.nombre_empresa||'—', c.contacto||'—', c.email||'—', c.telefono||'—',
        c.total_envios||0, c.entregados||0, c.en_transito||0, c.cancelados||0,
        fmtFecha(c.primer_envio), fmtFecha(c.ultimo_envio)
      ]);
      xlsxDataRowColored(row, i);
      // Color eficiencia
      const pct = c.total_envios > 0 ? (c.entregados / c.total_envios) * 100 : 0;
      const ef = row.getCell(6);
      ef.fill = { type:'pattern', pattern:'solid', fgColor:{ argb: pct >= 70 ? COL.VERDE_BG : pct >= 40 ? COL.NARANJA_BG : COL.ROJO_BG } };
      ef.font = { name:'Calibri', size:10, bold:true, color:{ argb: pct >= 70 ? COL.VERDE_FG : pct >= 40 ? COL.NARANJA_FG : COL.ROJO_FG } };
      totT += c.total_envios||0; totE += c.entregados||0; totTr += c.en_transito||0; totC += c.cancelados||0;
    });

    ws.addRow([]);
    const tRow = ws.addRow([`TOTAL (${clientes.length} clientes)`,'','','',totT,totE,totTr,totC,'','']);
    xlsxTotales(tRow);

    await enviarExcel(res, wb, `reporte-clientes-${new Date().toISOString().slice(0,10)}.xlsx`);
  } catch (err) {
    console.error('Excel clientes:', err);
    res.status(500).send('Error al generar Excel');
  }
});

// ══════════════════════════════════════════════════════════════
// PDF — CLIENTES
// ══════════════════════════════════════════════════════════════
router.get('/clientes/pdf', isAuthenticated, async (req, res) => {
  try {
    const [clientes] = await db.query(`
      SELECT c.nombre_empresa, c.contacto, c.email, c.telefono,
        COUNT(e.id) as total_envios,
        SUM(CASE WHEN e.estado_actual='entregado' THEN 1 ELSE 0 END) as entregados,
        SUM(CASE WHEN e.estado_actual IN ('en-transito','en_transito') THEN 1 ELSE 0 END) as en_transito,
        SUM(CASE WHEN e.estado_actual='cancelado' THEN 1 ELSE 0 END) as cancelados
      FROM clientes c LEFT JOIN envios e ON c.id = e.cliente_id
      WHERE c.activo = 1 AND c.eliminado_en IS NULL
      GROUP BY c.id ORDER BY total_envios DESC
    `);

    const fecha = new Date().toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' });
    const totEnvios = clientes.reduce((a,c)=>a+(c.total_envios||0),0);

    const filas = clientes.map((c,i) => {
      const pct = c.total_envios > 0 ? Math.round((c.entregados/c.total_envios)*100) : 0;
      const pctCls = pct >= 70 ? 'verde' : pct >= 40 ? 'naranja' : 'rojo';
      return `<tr class="${i%2===0?'par':'impar'}">
        <td><strong>${c.nombre_empresa||'—'}</strong><br><span style="font-size:10px;color:#6b7280;">${c.contacto||''}</span></td>
        <td style="font-size:10px;">${c.email||'—'}</td>
        <td style="font-size:10px;">${c.telefono||'—'}</td>
        <td class="c"><strong>${c.total_envios||0}</strong></td>
        <td class="c" style="color:#065f46;font-weight:700;">${c.entregados||0}</td>
        <td class="c" style="color:#92400e;">${c.en_transito||0}</td>
        <td class="c" style="color:#991b1b;">${c.cancelados||0}</td>
        <td class="c"><span class="badge b-${pctCls}">${pct}%</span></td>
      </tr>`;
    }).join('');

    const cssPortrait = PDF_CSS.replace('A4 landscape','A4');
    res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Reporte Clientes — Transportes AB</title>
<style>${cssPortrait}</style></head><body>
<button class="print-btn" onclick="window.print()">🖨️ Guardar PDF</button>
${pdfEncabezado('Reporte por Cliente', `${clientes.length} clientes · ${totEnvios} envíos totales`, fecha)}
<div class="stats-grid" style="grid-template-columns:repeat(2,1fr);">
  <div class="stat-card s-azul"><div class="stat-n">${clientes.length}</div><div class="stat-l">Clientes Activos</div></div>
  <div class="stat-card s-verde"><div class="stat-n">${totEnvios}</div><div class="stat-l">Total Envíos</div></div>
</div>
<table><thead><tr>
  <th>Cliente / Contacto</th><th>Email</th><th>Teléfono</th>
  <th class="c">Total</th><th class="c">Entregados</th><th class="c">En Tránsito</th><th class="c">Cancelados</th><th class="c">Efectividad</th>
</tr></thead><tbody>${filas}</tbody></table>
<div class="footer">Transportes AB · Sistema de Rastreo · ${fecha}</div>
</body></html>`);
  } catch (err) {
    console.error('PDF clientes:', err);
    res.status(500).send('Error al generar PDF');
  }
});

// ══════════════════════════════════════════════════════════════
// EXCEL — PERÍODO
// ══════════════════════════════════════════════════════════════
router.get('/periodo/excel', isAuthenticated, async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    let where = '1=1'; const params = [];
    if (fecha_inicio) { where += ' AND DATE(e.fecha_creacion) >= ?'; params.push(fecha_inicio); }
    if (fecha_fin)    { where += ' AND DATE(e.fecha_creacion) <= ?'; params.push(fecha_fin); }

    const [envios] = await db.query(`
      SELECT e.numero_tracking,
        COALESCE(c.nombre_empresa, e.cliente_nombre, 'Sin cliente') as nombre_empresa,
        e.origen, e.destino, e.estado_actual, e.peso, e.fecha_creacion, e.fecha_estimada_entrega
      FROM envios e LEFT JOIN clientes c ON e.cliente_id = c.id
      WHERE ${where} ORDER BY e.fecha_creacion DESC`, params);

    const sub = fecha_inicio && fecha_fin
      ? `Período: ${fecha_inicio} al ${fecha_fin}`
      : fecha_inicio ? `Desde: ${fecha_inicio}` : fecha_fin ? `Hasta: ${fecha_fin}` : 'Todos los períodos';

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Transportes AB'; wb.created = new Date();
    const ws = wb.addWorksheet('Por Período');

    ws.columns = [
      {key:'a',width:22},{key:'b',width:28},{key:'c',width:34},
      {key:'d',width:34},{key:'e',width:20},{key:'f',width:12},
      {key:'g',width:18},{key:'h',width:18},
    ];

    xlsxHeader(ws, 'Reporte por Período', sub, 8);
    const hRow = ws.addRow(['N° Tracking','Cliente','Origen','Destino','Estado','Peso (kg)','Fecha Creación','Entrega Estimada']);
    xlsxColHeader(hRow);

    let ent=0, tr=0, can=0;
    envios.forEach((e, i) => {
      const row = ws.addRow([
        e.numero_tracking, e.nombre_empresa||'—', e.origen||'—', e.destino||'—',
        fmtEstado(e.estado_actual), e.peso?parseFloat(e.peso):'—',
        fmtFecha(e.fecha_creacion), fmtFecha(e.fecha_estimada_entrega)
      ]);
      xlsxDataRowColored(row, i);
      colorEstadoCell(row.getCell(5), e.estado_actual);
      if (e.estado_actual==='entregado') ent++;
      else if (e.estado_actual==='cancelado') can++;
      else if ((e.estado_actual||'').includes('transito')) tr++;
    });

    ws.addRow([]);
    const tRow = ws.addRow([`TOTAL: ${envios.length}`,'','','',`✔ Entregados: ${ent}`,'',`↑ En Tránsito: ${tr}`,`✖ Cancelados: ${can}`]);
    xlsxTotales(tRow);

    await enviarExcel(res, wb, `reporte-periodo-${new Date().toISOString().slice(0,10)}.xlsx`);
  } catch (err) {
    console.error('Excel periodo:', err);
    res.status(500).send('Error al generar Excel');
  }
});

// ══════════════════════════════════════════════════════════════
// PDF — PERÍODO
// ══════════════════════════════════════════════════════════════
router.get('/periodo/pdf', isAuthenticated, async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    let where = '1=1'; const params = [];
    if (fecha_inicio) { where += ' AND DATE(e.fecha_creacion) >= ?'; params.push(fecha_inicio); }
    if (fecha_fin)    { where += ' AND DATE(e.fecha_creacion) <= ?'; params.push(fecha_fin); }

    const [envios] = await db.query(`
      SELECT e.numero_tracking,
        COALESCE(c.nombre_empresa, e.cliente_nombre, 'Sin cliente') as nombre_empresa,
        e.origen, e.destino, e.estado_actual, e.peso, e.fecha_creacion
      FROM envios e LEFT JOIN clientes c ON e.cliente_id = c.id
      WHERE ${where} ORDER BY e.fecha_creacion DESC`, params);

    const [sArr] = await db.query(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN estado_actual='entregado' THEN 1 ELSE 0 END) as entregados,
        SUM(CASE WHEN estado_actual IN ('en-transito','en_transito') THEN 1 ELSE 0 END) as en_transito,
        SUM(CASE WHEN estado_actual='cancelado' THEN 1 ELSE 0 END) as cancelados
      FROM envios e WHERE ${where}`, params);

    const st = sArr[0];
    const fecha = new Date().toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' });
    const sub = fecha_inicio && fecha_fin
      ? `Período: ${fecha_inicio} al ${fecha_fin}`
      : fecha_inicio ? `Desde: ${fecha_inicio}` : fecha_fin ? `Hasta: ${fecha_fin}` : 'Todos los períodos';

    const filas = envios.map((e,i) => `
      <tr class="${i%2===0?'par':'impar'}">
        <td><span class="track">${e.numero_tracking}</span></td>
        <td>${e.nombre_empresa||'—'}</td>
        <td style="font-size:10px;">${(e.origen||'—').substring(0,36)}</td>
        <td style="font-size:10px;">${(e.destino||'—').substring(0,36)}</td>
        <td class="c">${badgeEstado(e.estado_actual)}</td>
        <td class="c">${e.peso||'—'}</td>
        <td class="c">${fmtFecha(e.fecha_creacion)}</td>
      </tr>`).join('');

    res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Reporte Período — Transportes AB</title>
<style>${PDF_CSS}</style></head><body>
<button class="print-btn" onclick="window.print()">🖨️ Guardar PDF</button>
${pdfEncabezado('Reporte por Período', sub, fecha)}
<div class="stats-grid" style="grid-template-columns:repeat(4,1fr);">
  <div class="stat-card s-azul"><div class="stat-n">${st.total||0}</div><div class="stat-l">Total</div></div>
  <div class="stat-card s-verde"><div class="stat-n">${st.entregados||0}</div><div class="stat-l">Entregados</div></div>
  <div class="stat-card s-naranja"><div class="stat-n">${st.en_transito||0}</div><div class="stat-l">En Tránsito</div></div>
  <div class="stat-card s-rojo"><div class="stat-n">${st.cancelados||0}</div><div class="stat-l">Cancelados</div></div>
</div>
<table><thead><tr>
  <th>N° Tracking</th><th>Cliente</th><th>Origen</th><th>Destino</th>
  <th class="c">Estado</th><th class="c">Peso kg</th><th class="c">Fecha</th>
</tr></thead><tbody>${filas}</tbody></table>
<div class="footer">Transportes AB · Sistema de Rastreo · ${fecha}</div>
</body></html>`);
  } catch (err) {
    console.error('PDF periodo:', err);
    res.status(500).send('Error al generar PDF');
  }
});

// ══════════════════════════════════════════════════════════════
// EXCEL — RENDIMIENTO
// ══════════════════════════════════════════════════════════════
router.get('/rendimiento/excel', isAuthenticated, async (req, res) => {
  try {
    const [eficiencia] = await db.query(`
      SELECT estado_actual, COUNT(*) as total,
        ROUND(COUNT(*)*100.0/(SELECT COUNT(*) FROM envios),2) as porcentaje
      FROM envios GROUP BY estado_actual ORDER BY total DESC`);

    const [topClientes] = await db.query(`
      SELECT COALESCE(c.nombre_empresa, 'Sin cliente') as nombre_empresa,
        COUNT(e.id) as total_envios,
        SUM(CASE WHEN e.estado_actual='entregado' THEN 1 ELSE 0 END) as entregados
      FROM clientes c LEFT JOIN envios e ON c.id=e.cliente_id
      WHERE c.activo=1 AND c.eliminado_en IS NULL
      GROUP BY c.id ORDER BY total_envios DESC LIMIT 10`);

    const [retrasados] = await db.query(`
      SELECT e.numero_tracking,
        COALESCE(c.nombre_empresa, e.cliente_nombre,'Sin cliente') as nombre_empresa,
        e.destino, e.fecha_estimada_entrega,
        DATEDIFF(CURDATE(),DATE(e.fecha_estimada_entrega)) as dias_retraso
      FROM envios e LEFT JOIN clientes c ON e.cliente_id=c.id
      WHERE e.estado_actual NOT IN ('entregado','cancelado')
      AND e.fecha_estimada_entrega < CURDATE()
      ORDER BY dias_retraso DESC`);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Transportes AB'; wb.created = new Date();

    // Hoja 1 — Eficiencia
    const ws1 = wb.addWorksheet('Eficiencia por Estado');
    ws1.columns = [{key:'a',width:28},{key:'b',width:16},{key:'c',width:16}];
    xlsxHeader(ws1, 'Rendimiento — Eficiencia por Estado', null, 3);
    const h1 = ws1.addRow(['Estado','Total Envíos','% del Total']);
    xlsxColHeader(h1);
    eficiencia.forEach((e,i) => {
      const row = ws1.addRow([fmtEstado(e.estado_actual), e.total, `${e.porcentaje}%`]);
      xlsxDataRowColored(row, i);
      colorEstadoCell(row.getCell(1), e.estado_actual);
    });

    // Hoja 2 — Top Clientes
    const ws2 = wb.addWorksheet('Top Clientes');
    ws2.columns = [{key:'a',width:32},{key:'b',width:16},{key:'c',width:14},{key:'d',width:16}];
    xlsxHeader(ws2, 'Rendimiento — Top Clientes', null, 4);
    const h2 = ws2.addRow(['Cliente','Total Envíos','Entregados','Efectividad %']);
    xlsxColHeader(h2);
    topClientes.forEach((c,i) => {
      const pct = c.total_envios>0?Math.round((c.entregados/c.total_envios)*100):0;
      const row = ws2.addRow([c.nombre_empresa, c.total_envios, c.entregados, `${pct}%`]);
      xlsxDataRowColored(row, i);
      const ef = row.getCell(4);
      ef.fill = { type:'pattern', pattern:'solid', fgColor:{ argb: pct>=70?COL.VERDE_BG:pct>=40?COL.NARANJA_BG:COL.ROJO_BG } };
      ef.font = { name:'Calibri', size:10, bold:true, color:{ argb: pct>=70?COL.VERDE_FG:pct>=40?COL.NARANJA_FG:COL.ROJO_FG } };
    });

    // Hoja 3 — Retrasados
    const ws3 = wb.addWorksheet('Envíos Retrasados');
    ws3.columns = [{key:'a',width:22},{key:'b',width:28},{key:'c',width:34},{key:'d',width:20},{key:'e',width:16}];
    xlsxHeader(ws3, 'Rendimiento — Envíos Retrasados', `${retrasados.length} envíos pendientes`, 5);
    const h3 = ws3.addRow(['N° Tracking','Cliente','Destino','Fecha Estimada','Días de Retraso']);
    xlsxColHeader(h3);
    retrasados.forEach((e,i) => {
      const row = ws3.addRow([e.numero_tracking, e.nombre_empresa, e.destino||'—', fmtFecha(e.fecha_estimada_entrega), e.dias_retraso]);
      xlsxDataRowColored(row, i);
      const dc = row.getCell(5);
      dc.fill = { type:'pattern',pattern:'solid',fgColor:{argb:e.dias_retraso>7?COL.ROJO_BG:COL.NARANJA_BG} };
      dc.font = { name:'Calibri',size:10,bold:true,color:{argb:e.dias_retraso>7?COL.ROJO_FG:COL.NARANJA_FG} };
      dc.alignment = { horizontal:'center', vertical:'middle' };
    });

    await enviarExcel(res, wb, `reporte-rendimiento-${new Date().toISOString().slice(0,10)}.xlsx`);
  } catch (err) {
    console.error('Excel rendimiento:', err);
    res.status(500).send('Error al generar Excel');
  }
});

// ══════════════════════════════════════════════════════════════
// PDF — RENDIMIENTO
// ══════════════════════════════════════════════════════════════
router.get('/rendimiento/pdf', isAuthenticated, async (req, res) => {
  try {
    const [eficiencia] = await db.query(`
      SELECT estado_actual, COUNT(*) as total,
        ROUND(COUNT(*)*100.0/(SELECT COUNT(*) FROM envios),2) as porcentaje
      FROM envios GROUP BY estado_actual ORDER BY total DESC`);

    const [topClientes] = await db.query(`
      SELECT COALESCE(c.nombre_empresa,'Sin cliente') as nombre_empresa,
        COUNT(e.id) as total_envios,
        SUM(CASE WHEN e.estado_actual='entregado' THEN 1 ELSE 0 END) as entregados
      FROM clientes c LEFT JOIN envios e ON c.id=e.cliente_id
      WHERE c.activo=1 AND c.eliminado_en IS NULL
      GROUP BY c.id ORDER BY total_envios DESC LIMIT 5`);

    const [retrasados] = await db.query(`
      SELECT e.numero_tracking,
        COALESCE(c.nombre_empresa,e.cliente_nombre,'Sin cliente') as nombre_empresa,
        e.destino, e.fecha_estimada_entrega,
        DATEDIFF(CURDATE(),DATE(e.fecha_estimada_entrega)) as dias_retraso
      FROM envios e LEFT JOIN clientes c ON e.cliente_id=c.id
      WHERE e.estado_actual NOT IN ('entregado','cancelado')
      AND e.fecha_estimada_entrega < CURDATE()
      ORDER BY dias_retraso DESC`);

    const fecha = new Date().toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' });
    const totalEnvios = eficiencia.reduce((a,e)=>a+e.total,0);

    const filasEf = eficiencia.map((e,i) => {
      const pct = parseFloat(e.porcentaje||0);
      return `<tr class="${i%2===0?'par':'impar'}">
        <td>${badgeEstado(e.estado_actual)}</td>
        <td class="c"><strong>${e.total}</strong></td>
        <td>
          <div style="background:#e5e7eb;border-radius:4px;height:12px;overflow:hidden;display:inline-block;width:100px;vertical-align:middle;">
            <div style="height:100%;width:${Math.min(pct,100)}%;background:#1e3a8a;border-radius:4px;"></div>
          </div>
          <strong style="margin-left:6px;">${pct}%</strong>
        </td>
      </tr>`;
    }).join('');

    const filasCli = topClientes.map((c,i) => {
      const pct = c.total_envios>0?Math.round((c.entregados/c.total_envios)*100):0;
      const cls = pct>=70?'verde':pct>=40?'naranja':'rojo';
      return `<tr class="${i%2===0?'par':'impar'}">
        <td><strong>${c.nombre_empresa}</strong></td>
        <td class="c">${c.total_envios}</td>
        <td class="c" style="color:#065f46;font-weight:700;">${c.entregados}</td>
        <td class="c"><span class="badge b-${cls}">${pct}%</span></td>
      </tr>`;
    }).join('');

    const filasRet = retrasados.map((e,i) => `
      <tr class="${i%2===0?'par':'impar'}">
        <td><span class="track">${e.numero_tracking}</span></td>
        <td>${e.nombre_empresa||'—'}</td>
        <td style="font-size:10px;">${(e.destino||'—').substring(0,40)}</td>
        <td class="c">${fmtFecha(e.fecha_estimada_entrega)}</td>
        <td class="c"><span class="badge ${e.dias_retraso>7?'b-rojo':'b-naranja'}">${e.dias_retraso} días</span></td>
      </tr>`).join('');

    const cssPdf = PDF_CSS.replace('A4 landscape','A4');
    res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Rendimiento — Transportes AB</title>
<style>${cssPdf}</style></head><body>
<button class="print-btn" onclick="window.print()">🖨️ Guardar PDF</button>
${pdfEncabezado('Reporte de Rendimiento', `${totalEnvios} envíos totales analizados`, fecha)}
<div class="grid2">
  <div>
    <div class="seccion-titulo">📊 Eficiencia por Estado</div>
    <table><thead><tr><th>Estado</th><th class="c">Envíos</th><th>Distribución</th></tr></thead>
    <tbody>${filasEf}</tbody></table>
  </div>
  <div>
    <div class="seccion-titulo">🏆 Top 5 Clientes</div>
    <table><thead><tr><th>Cliente</th><th class="c">Total</th><th class="c">Entregados</th><th class="c">Efectividad</th></tr></thead>
    <tbody>${filasCli}</tbody></table>
  </div>
</div>
<div class="seccion-titulo">⚠️ Envíos Retrasados (${retrasados.length})</div>
<table><thead><tr><th>N° Tracking</th><th>Cliente</th><th>Destino</th><th class="c">Fecha Estimada</th><th class="c">Días de Retraso</th></tr></thead>
<tbody>${filasRet}</tbody></table>
<div class="footer">Transportes AB · Sistema de Rastreo · ${fecha}</div>
</body></html>`);
  } catch (err) {
    console.error('PDF rendimiento:', err);
    res.status(500).send('Error al generar PDF');
  }
});

module.exports = router;