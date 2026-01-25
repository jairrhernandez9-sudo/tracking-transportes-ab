const express = require('express');
const router = express.Router();
const db = require('../config/database');
const QRCode = require('qrcode');

// ✅ FUNCIÓN PARA OBTENER CONFIGURACIÓN
async function obtenerConfiguracion() {
  const [configs] = await db.query('SELECT * FROM configuracion_sistema WHERE categoria = "tracking"');
  
  const configuracion = {};
  
  configs.forEach(config => {
    let valor = config.valor;
    
    // Convertir según tipo
    if (config.tipo === 'boolean') {
      valor = valor === 'true';
    }
    
    configuracion[config.clave] = valor;
  });
  
  return configuracion;
}

// ✅ Página principal de tracking - AHORA CON CONFIG
router.get('/', async (req, res) => {
  try {
    const config = await obtenerConfiguracion();
    
    res.render('tracking-public', {
      title: 'Rastrear Envío - Transportes AB',
      config: config  // ✅ AHORA SÍ PASA LA CONFIGURACIÓN
    });
  } catch (error) {
    console.error('Error al cargar configuración:', error);
    // Si falla, renderiza con config vacío para que use valores por defecto
    res.render('tracking-public', {
      title: 'Rastrear Envío - Transportes AB',
      config: {}
    });
  }
});

// API para buscar envío por número de tracking O referencia del cliente
router.get('/buscar/:numeroTracking', async (req, res) => {
  try {
    const { numeroTracking } = req.params;
    
    // Buscar envío por número de tracking O por referencia del cliente
    const [envios] = await db.query(
      `SELECT e.*, c.nombre_empresa, c.contacto, c.telefono, c.email 
       FROM envios e 
       LEFT JOIN clientes c ON e.cliente_id = c.id 
       WHERE e.numero_tracking = ? OR e.referencia_cliente = ?`,
      [numeroTracking, numeroTracking]
    );
    
    if (envios.length === 0) {
      return res.json({ 
        success: false, 
        message: 'No se encontró ningún envío con ese número de tracking o referencia' 
      });
    }
    
    const envio = envios[0];
    
    // Buscar historial de estados
    const [historial] = await db.query(
      `SELECT * FROM historial_estados 
       WHERE envio_id = ? 
       ORDER BY fecha_hora ASC`,
      [envio.id]
    );
    
    // Buscar fotos para cada estado del historial
    for (let estado of historial) {
      const [fotos] = await db.query(
        'SELECT * FROM fotos_evidencia WHERE historial_estado_id = ?',
        [estado.id]
      );
      estado.fotos = fotos;
    }
    
    res.json({
      success: true,
      envio,
      historial
    });
    
  } catch (error) {
    console.error('Error buscando envío:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al buscar el envío' 
    });
  }
});

// Generar código QR para un tracking
router.get('/qr/:numeroTracking', async (req, res) => {
  try {
    const { numeroTracking } = req.params;
    
    // URL completa del tracking
    const trackingURL = `${req.protocol}://${req.get('host')}/tracking?numero=${numeroTracking}`;
    
    // Generar QR
    const qrImage = await QRCode.toDataURL(trackingURL, {
      width: 300,
      margin: 2,
      color: {
        dark: '#1e3a8a',  // Azul de Transportes AB
        light: '#ffffff'
      }
    });
    
    res.json({
      success: true,
      qrImage,
      url: trackingURL
    });
    
  } catch (error) {
    console.error('Error generando QR:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al generar código QR' 
    });
  }
});

module.exports = router;