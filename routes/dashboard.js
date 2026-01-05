const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { isAuthenticated } = require('../middleware/auth');

router.get('/', isAuthenticated, async (req, res) => {
  try {
    // Estadísticas básicas
    const [totalEnvios] = await db.query('SELECT COUNT(*) as total FROM envios');
    const [enTransito] = await db.query('SELECT COUNT(*) as total FROM envios WHERE estado_actual IN ("en_transito", "en_ruta_entrega")');
    const [entregados] = await db.query('SELECT COUNT(*) as total FROM envios WHERE estado_actual = "entregado"');
    const [pendientes] = await db.query('SELECT COUNT(*) as total FROM envios WHERE estado_actual = "pendiente"');
    
    // Envíos retrasados
    const [enviosRetrasados] = await db.query(`
      SELECT COUNT(*) as total 
      FROM envios 
      WHERE estado_actual NOT IN ('entregado', 'cancelado')
      AND DATEDIFF(NOW(), fecha_creacion) > 5
    `);
    
    // Cambio vs mes anterior
    const [mesActual] = await db.query('SELECT COUNT(*) as total FROM envios WHERE MONTH(fecha_creacion) = MONTH(NOW()) AND YEAR(fecha_creacion) = YEAR(NOW())');
    const [mesAnterior] = await db.query('SELECT COUNT(*) as total FROM envios WHERE MONTH(fecha_creacion) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH)) AND YEAR(fecha_creacion) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH))');
    
    const cambioEnvios = mesAnterior[0].total > 0 
      ? (((mesActual[0].total - mesAnterior[0].total) / mesAnterior[0].total) * 100).toFixed(1)
      : 0;
    
    // Tasa de entrega
    const tasaEntrega = totalEnvios[0].total > 0 
      ? ((entregados[0].total / totalEnvios[0].total) * 100).toFixed(1)
      : 0;
    
    // Envíos por mes (últimos 6 meses)
    const [enviosPorMes] = await db.query(`
      SELECT 
        DATE_FORMAT(fecha_creacion, '%Y-%m') as mes,
        COUNT(*) as cantidad
      FROM envios
      WHERE fecha_creacion >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY mes
      ORDER BY mes ASC
    `);
    
    // Envíos por estado
    const [enviosPorEstado] = await db.query(`
      SELECT 
        estado_actual,
        COUNT(*) as cantidad
      FROM envios
      GROUP BY estado_actual
      ORDER BY cantidad DESC
    `);
    
    // Envíos recientes
    const [enviosRecientes] = await db.query(`
      SELECT 
        e.numero_tracking,
        e.estado_actual,
        e.destino,
        e.fecha_creacion,
        c.nombre_empresa
      FROM envios e
      LEFT JOIN clientes c ON e.cliente_id = c.id
      ORDER BY e.fecha_creacion DESC
      LIMIT 5
    `);
    
    res.render('dashboard/index', {
      title: 'Dashboard',
      user: {
        nombre: req.session.userName,
        email: req.session.userEmail,
        rol: req.session.userRole
      },
      stats: {
        total_envios: totalEnvios[0].total,
        en_transito: enTransito[0].total,
        entregados: entregados[0].total,
        pendientes: pendientes[0].total,
        envios_retrasados: enviosRetrasados[0].total,
        tasa_entrega: tasaEntrega,
        cambio_envios: cambioEnvios
      },
      enviosPorMes: JSON.stringify(enviosPorMes),
      enviosPorEstado: JSON.stringify(enviosPorEstado),
      enviosRecientes
    });
    
  } catch (error) {
    console.error('Error al cargar dashboard:', error);
    res.status(500).send('Error al cargar el dashboard');
  }
});

// Nueva ruta para obtener datos de gráfica con filtros
router.get('/api/grafica-flujo', isAuthenticated, async (req, res) => {
  try {
    const { periodo = 'año', tipo = 'creados' } = req.query;
    
    let query = '';
    let params = [];
    
    // Construir WHERE clause
    let whereClause = '';
    if (tipo === 'entregados') {
      whereClause = "WHERE estado_actual = 'entregado' AND ";
    } else {
      whereClause = 'WHERE ';
    }
    
    // Determinar el período
    switch(periodo) {
      case 'semana':
        query = `
          SELECT 
            DATE(fecha_creacion) as periodo,
            COUNT(*) as cantidad
          FROM envios
          ${whereClause} fecha_creacion >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          GROUP BY DATE(fecha_creacion)
          ORDER BY periodo ASC
        `;
        break;
        
      case 'mes':
        query = `
          SELECT 
            DATE(fecha_creacion) as periodo,
            COUNT(*) as cantidad
          FROM envios
          ${whereClause} fecha_creacion >= DATE_SUB(NOW(), INTERVAL 30 DAY)
          GROUP BY DATE(fecha_creacion)
          ORDER BY periodo ASC
        `;
        break;
        
      case 'año':
      default:
        query = `
          SELECT 
            DATE_FORMAT(fecha_creacion, '%Y-%m') as periodo,
            COUNT(*) as cantidad
          FROM envios
          ${whereClause} fecha_creacion >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
          GROUP BY DATE_FORMAT(fecha_creacion, '%Y-%m')
          ORDER BY periodo ASC
        `;
        break;
    }
    
    console.log('Query ejecutada:', query); // Para debugging
    
    const [datos] = await db.query(query, params);
    
    console.log('Datos obtenidos:', datos); // Para debugging
    
// Formatear las etiquetas según el período
const datosFormateados = datos.map(item => {
  let label = item.periodo;
  
  if (periodo === 'semana' || periodo === 'mes') {
    // Formato: "Lun 15", "Mar 16", etc.
    try {
      const fecha = new Date(item.periodo);
      // Verificar que la fecha es válida
      if (isNaN(fecha.getTime())) {
        console.error('Fecha inválida:', item.periodo);
        return null;
      }
      const dia = fecha.getDate();
      const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const diaSemana = dias[fecha.getDay()];
      label = `${diaSemana} ${dia}`;
    } catch (e) {
      console.error('Error al formatear fecha:', e);
      return null;
    }
  } else {
    // Formato: "Ene", "Feb", etc.
    if (item.periodo && item.periodo.includes('-')) {
      const [año, mes] = item.periodo.split('-');
      const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      label = meses[parseInt(mes) - 1] || item.periodo;
    }
  }
  
  return {
    periodo: label,
    cantidad: item.cantidad
  };
}).filter(item => item !== null); // Eliminar items null

console.log('Datos formateados:', datosFormateados);

res.json(datosFormateados);
    
  } catch (error) {
    console.error('Error al obtener datos de gráfica:', error);
    res.status(500).json({ error: 'Error al cargar datos' });
  }
});

// API de búsqueda de envíos
router.get('/api/buscar', isAuthenticated, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.json([]);
    }
    
    const searchTerm = `%${q}%`;
    
    const [resultados] = await db.query(`
      SELECT 
        e.id,
        e.numero_tracking,
        e.estado_actual,
        e.destino,
        e.fecha_creacion,
        c.nombre_empresa
      FROM envios e
      LEFT JOIN clientes c ON e.cliente_id = c.id
      WHERE 
        e.numero_tracking LIKE ? OR
        c.nombre_empresa LIKE ? OR
        e.destino LIKE ?
      ORDER BY e.fecha_creacion DESC
      LIMIT 10
    `, [searchTerm, searchTerm, searchTerm]);
    
    res.json(resultados);
    
  } catch (error) {
    console.error('Error en búsqueda:', error);
    res.status(500).json({ error: 'Error al buscar' });
  }
});

module.exports = router;