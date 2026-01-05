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

// Lista de envíos retrasados
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { criticidad } = req.query;
    
    // Query principal con normalización de estados
    let query = `
      SELECT 
        e.*,
        c.nombre_empresa,
        c.contacto,
        DATEDIFF(CURDATE(), DATE(e.fecha_estimada_entrega)) as dias_retraso,
        LOWER(REPLACE(REPLACE(e.estado_actual, '_', '-'), ' ', '-')) as estado_normalizado
      FROM envios e
      LEFT JOIN clientes c ON e.cliente_id = c.id
      WHERE DATE(e.fecha_estimada_entrega) < CURDATE()
        AND LOWER(e.estado_actual) NOT IN ('entregado', 'cancelado')
    `;
    
    // Filtro de criticidad
    if (criticidad === 'critico') {
      query += ` AND DATEDIFF(CURDATE(), DATE(e.fecha_estimada_entrega)) > 7`;
    } else if (criticidad === 'alto') {
      query += ` AND DATEDIFF(CURDATE(), DATE(e.fecha_estimada_entrega)) BETWEEN 4 AND 7`;
    } else if (criticidad === 'medio') {
      query += ` AND DATEDIFF(CURDATE(), DATE(e.fecha_estimada_entrega)) BETWEEN 1 AND 3`;
    }
    
    query += ` ORDER BY dias_retraso DESC`;
    
    const [enviosRetrasados] = await db.query(query);
    
    // Normalizar estados en los resultados
    enviosRetrasados.forEach(envio => {
      // Normalizar estado_actual para uniformidad
      envio.estado_original = envio.estado_actual;
      envio.estado_actual = envio.estado_normalizado || 
                            envio.estado_actual.toLowerCase().replace(/_/g, '-').replace(/ /g, '-');
    });
    
    // Log de debug
    console.log('📊 Envíos retrasados encontrados:', enviosRetrasados.length);
    if (enviosRetrasados.length > 0) {
      console.log('📋 Ejemplo de datos:');
      console.log({
        tracking: enviosRetrasados[0].numero_tracking,
        fecha_estimada: enviosRetrasados[0].fecha_estimada_entrega,
        dias_retraso: enviosRetrasados[0].dias_retraso,
        estado_original: enviosRetrasados[0].estado_original,
        estado_normalizado: enviosRetrasados[0].estado_actual,
        fecha_hoy: new Date().toLocaleDateString('es-MX')
      });
      
      // Contar estados
      const estadosCount = {};
      enviosRetrasados.forEach(e => {
        const estado = e.estado_actual;
        estadosCount[estado] = (estadosCount[estado] || 0) + 1;
      });
      console.log('📊 Distribución de estados:', estadosCount);
    }
    
    res.render('envios-retrasados/index', {
      title: 'Envíos Retrasados',
      user: {
        id: req.session.userId,
        nombre: req.session.userName,
        email: req.session.userEmail,
        rol: req.session.userRole
      },
      enviosRetrasados,
      criticidad: criticidad || 'todos'
    });
  } catch (error) {
    console.error('❌ Error al obtener envíos retrasados:', error);
    res.status(500).send('Error al cargar los envíos retrasados: ' + error.message);
  }
});

module.exports = router;