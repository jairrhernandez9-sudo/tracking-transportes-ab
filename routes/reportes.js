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
    
    const [clientesActivos] = await db.query('SELECT COUNT(*) as total FROM clientes WHERE activo = 1');
    
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
        c.nombre_empresa,
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
      WHERE c.activo = 1
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
        c.nombre_empresa,
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
        c.nombre_empresa,
        COUNT(e.id) as total_envios,
        SUM(CASE WHEN e.estado_actual = 'entregado' THEN 1 ELSE 0 END) as entregados
      FROM clientes c
      LEFT JOIN envios e ON c.id = e.cliente_id
      WHERE c.activo = 1
      GROUP BY c.id
      ORDER BY total_envios DESC
      LIMIT 5
    `);
    
    // Envíos retrasados
    const [retrasados] = await db.query(`
      SELECT 
        e.*,
        c.nombre_empresa,
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

module.exports = router;