const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Helper: parse a CSV line respecting quoted fields and custom separator
function parseCSVLine(line, sep) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuotes = !inQuotes;
    } else if (line[i] === sep && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += line[i];
    }
  }
  result.push(current.trim());
  return result;
}

// Helper: detect CSV separator from first line
function detectSeparator(line) {
  const commas = (line.match(/,/g) || []).length;
  const semicolons = (line.match(/;/g) || []).length;
  return semicolons > commas ? ';' : ',';
}

// Multer para CSVs en memoria
const uploadCSV = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

// Configuración multer para logo de empresa
const storageLogo = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'public/images';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, 'logo-empresa' + path.extname(file.originalname));
  }
});
const uploadLogo = multer({
  storage: storageLogo,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: function (req, file, cb) {
    const allowed = /jpeg|jpg|png|gif|webp|svg/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Solo imágenes (JPEG, PNG, GIF, WEBP, SVG)'));
  }
});

// Configuración multer para logo B&N de etiqueta
const storageLogoBw = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'public/images';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, 'logo-empresa-bw' + path.extname(file.originalname));
  }
});
const uploadLogoBw = multer({
  storage: storageLogoBw,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowed = /jpeg|jpg|png|gif|webp|svg/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Solo imágenes (JPEG, PNG, GIF, WEBP, SVG)'));
  }
});

// Middleware para verificar que solo admins accedan
router.use(isAuthenticated);

// Obtener configuración
async function obtenerConfiguracion() {
  const [configs] = await db.query('SELECT * FROM configuracion_sistema ORDER BY categoria, clave');
  
  const configuracion = {
    empresa: {},
    tarifas: {},
    notificaciones: {},
    alertas: {},
    tracking: {},
    etiqueta: {},
    guia: {}
  };
  
  configs.forEach(config => {
    let valor = config.valor;
    
    // Convertir según tipo
    if (config.tipo === 'numero') {
      valor = parseFloat(valor) || 0;
    } else if (config.tipo === 'boolean') {
      valor = valor === 'true';
    } else if (config.tipo === 'json') {
      try {
        valor = JSON.parse(valor);
      } catch (e) {
        valor = {};
      }
    }
    
    if (configuracion[config.categoria]) {
      configuracion[config.categoria][config.clave] = valor;
    }
  });
  
  return configuracion;
}

// ⬅️ NUEVA FUNCIÓN: Obtener direcciones de empresa
async function obtenerDireccionesEmpresa() {
  const [direcciones] = await db.query(`
    SELECT * FROM direcciones_empresa 
    WHERE activa = 1 
    ORDER BY es_predeterminada DESC, alias ASC
  `);
  return direcciones;
}

// ── Helpers templates ──────────────────────────────────────────────────────
async function obtenerTiposEmpaques() {
  try {
    const [rows] = await db.query('SELECT * FROM tipos_empaques ORDER BY orden ASC, nombre ASC');
    return rows;
  } catch (e) {
    return [];
  }
}

async function obtenerTemplates() {
  const [rows] = await db.query('SELECT * FROM etiqueta_templates ORDER BY nombre ASC');
  return rows;
}

async function obtenerGuiaTemplates() {
  try {
    const [rows] = await db.query('SELECT * FROM guia_templates ORDER BY nombre ASC');
    return rows;
  } catch (e) {
    return [];
  }
}

// Página principal de configuración
router.get('/', async (req, res) => {
  try {
    const configuracion = await obtenerConfiguracion();
    const todasDirecciones  = await obtenerDireccionesEmpresa();
    const direccionesEmpresa  = todasDirecciones; // backward compat
    const direccionesOrigen   = todasDirecciones.filter(d => d.tipo === 'origen' || d.tipo === 'ambos');
    const direccionesDestino  = todasDirecciones.filter(d => d.tipo === 'destino' || d.tipo === 'ambos');
    const etiquetaTemplates = await obtenerTemplates();
    const guiaTemplates     = await obtenerGuiaTemplates();
    const tiposEmpaques     = await obtenerTiposEmpaques();
    const [pictogramas] = await db.query(
      'SELECT * FROM pictogramas ORDER BY orden ASC, nombre ASC'
    ).catch(() => [[]]);

    // Leer pagina_inicio del usuario actual
    const [[usuarioRow]] = await db.query(
      'SELECT pagina_inicio FROM usuarios WHERE id = ?', [req.session.userId]
    );
    const paginaInicio = usuarioRow?.pagina_inicio || 'dashboard';

    res.render('configuracion/index', {
      title: 'Configuración del Sistema',
      user: {
        id: req.session.userId,
        nombre: req.session.userName,
        email: req.session.userEmail,
        rol: req.session.userRole
      },
      config: configuracion,
      direccionesEmpresa,
      direccionesOrigen,
      direccionesDestino,
      etiquetaTemplates,
      guiaTemplates,
      tiposEmpaques,
      pictogramas: pictogramas || [],
      paginaInicio,
      success: req.query.success,
      error: req.query.error,
      query: req.query
    });
  } catch (error) {
    console.error('Error al cargar configuración:', error);
    res.status(500).send('Error al cargar configuración');
  }
});

// Actualizar configuración de empresa
router.post('/empresa', async (req, res) => {
  try {
    const {
      empresa_nombre,
      empresa_rfc,
      empresa_telefono,
      empresa_email,
      empresa_direccion,
      empresa_sitio_web,
      empresa_eslogan,
      empresa_telefono_adicional,
      empresa_logo_url,
      empresa_aviso_privacidad,
      lugares_expedicion
    } = req.body;

    const updates = [
      ['empresa_nombre', empresa_nombre],
      ['empresa_rfc', empresa_rfc],
      ['empresa_telefono', empresa_telefono],
      ['empresa_email', empresa_email],
      ['empresa_direccion', empresa_direccion],
      ['empresa_sitio_web', empresa_sitio_web],
      ['empresa_eslogan', empresa_eslogan],
      ['empresa_telefono_adicional', empresa_telefono_adicional],
      ['empresa_logo_url', empresa_logo_url],
      ['empresa_aviso_privacidad', empresa_aviso_privacidad],
      ['lugares_expedicion', lugares_expedicion]
    ];
    
    for (const [clave, valor] of updates) {
      await db.query(`
        INSERT INTO configuracion_sistema (clave, valor, tipo, categoria, descripcion, modificado_por)
        VALUES (?, ?, 'texto', 'empresa', ?, ?)
        ON DUPLICATE KEY UPDATE valor = ?, modificado_por = ?
      `, [clave, valor || '', 'Campo ' + clave, req.session.userId, valor || '', req.session.userId]);
    }
    
    res.redirect('/configuracion?success=empresa_actualizada');
  } catch (error) {
    console.error('Error al actualizar empresa:', error);
    res.redirect('/configuracion?error=error_servidor');
  }
});

// Actualizar tarifas
router.post('/tarifas', async (req, res) => {
  try {
    const { tarifa_base, tarifa_por_km, tarifa_seguro, iva_porcentaje, credito_habilitado } = req.body;

    const numericUpdates = [
      ['tarifa_base', tarifa_base],
      ['tarifa_por_km', tarifa_por_km],
      ['tarifa_seguro', tarifa_seguro],
      ['iva_porcentaje', iva_porcentaje]
    ];

    for (const [clave, valor] of numericUpdates) {
      await db.query(`
        INSERT INTO configuracion_sistema (clave, valor, tipo, categoria, descripcion, modificado_por)
        VALUES (?, ?, 'numero', 'tarifas', ?, ?)
        ON DUPLICATE KEY UPDATE valor = ?, modificado_por = ?
      `, [clave, valor || '0', 'Tarifa ' + clave, req.session.userId, valor || '0', req.session.userId]);
    }

    const creditoVal = credito_habilitado ? 'true' : 'false';
    await db.query(`
      INSERT INTO configuracion_sistema (clave, valor, tipo, categoria, descripcion, modificado_por)
      VALUES ('credito_habilitado', ?, 'boolean', 'tarifas', 'Habilitar pago por crédito', ?)
      ON DUPLICATE KEY UPDATE valor = ?, modificado_por = ?
    `, [creditoVal, req.session.userId, creditoVal, req.session.userId]);
    
    res.redirect('/configuracion?success=tarifas_actualizadas');
  } catch (error) {
    console.error('Error al actualizar tarifas:', error);
    res.redirect('/configuracion?error=error_servidor');
  }
});

// Actualizar notificaciones
router.post('/notificaciones', async (req, res) => {
  try {
    const {
      notif_email_activo,
      notif_sms_activo,
      notif_envio_creado,
      notif_envio_entregado,
      notif_envio_retrasado
    } = req.body;
    
    const updates = [
      ['notif_email_activo', notif_email_activo ? 'true' : 'false'],
      ['notif_sms_activo', notif_sms_activo ? 'true' : 'false'],
      ['notif_envio_creado', notif_envio_creado ? 'true' : 'false'],
      ['notif_envio_entregado', notif_envio_entregado ? 'true' : 'false'],
      ['notif_envio_retrasado', notif_envio_retrasado ? 'true' : 'false']
    ];
    
    for (const [clave, valor] of updates) {
      await db.query(
        'UPDATE configuracion_sistema SET valor = ?, modificado_por = ? WHERE clave = ?',
        [valor, req.session.userId, clave]
      );
    }
    
    res.redirect('/configuracion?success=notificaciones_actualizadas');
  } catch (error) {
    console.error('Error al actualizar notificaciones:', error);
    res.redirect('/configuracion?error=error_servidor');
  }
});

// Actualizar alertas
router.post('/alertas', async (req, res) => {
  try {
    const { dias_alerta_retraso, auto_cancelar_dias } = req.body;
    
    const updates = [
      ['dias_alerta_retraso', dias_alerta_retraso],
      ['auto_cancelar_dias', auto_cancelar_dias]
    ];
    
    for (const [clave, valor] of updates) {
      await db.query(
        'UPDATE configuracion_sistema SET valor = ?, modificado_por = ? WHERE clave = ?',
        [valor || '0', req.session.userId, clave]
      );
    }
    
    res.redirect('/configuracion?success=alertas_actualizadas');
  } catch (error) {
    console.error('Error al actualizar alertas:', error);
    res.redirect('/configuracion?error=error_servidor');
  }
});

// Actualizar tracking
router.post('/tracking', async (req, res) => {
  try {
    const {
      tracking_publico_activo,
      mostrar_fotos_tracking,
      mostrar_pdfs_tracking,
      mostrar_comentarios_tracking,
      mostrar_ubicaciones_tracking,
      mostrar_info_cliente_tracking,
      mostrar_datos_envio_tracking,
      mostrar_historial_completo_tracking,
      mostrar_qr_tracking,
      mostrar_boton_pdf_tracking,
      mostrar_boton_whatsapp_tracking,
      mostrar_boton_copiar_tracking,
      mostrar_seccion_features,
      mostrar_seccion_stats,
      mostrar_seccion_como_funciona,
      mostrar_seccion_cta
    } = req.body;
    
    const updates = [
      ['tracking_publico_activo', tracking_publico_activo ? 'true' : 'false'],
      ['mostrar_fotos_tracking', mostrar_fotos_tracking ? 'true' : 'false'],
      ['mostrar_pdfs_tracking', mostrar_pdfs_tracking ? 'true' : 'false'],
      ['mostrar_comentarios_tracking', mostrar_comentarios_tracking ? 'true' : 'false'],
      ['mostrar_ubicaciones_tracking', mostrar_ubicaciones_tracking ? 'true' : 'false'],
      ['mostrar_info_cliente_tracking', mostrar_info_cliente_tracking ? 'true' : 'false'],
      ['mostrar_datos_envio_tracking', mostrar_datos_envio_tracking ? 'true' : 'false'],
      ['mostrar_historial_completo_tracking', mostrar_historial_completo_tracking ? 'true' : 'false'],
      ['mostrar_qr_tracking', mostrar_qr_tracking ? 'true' : 'false'],
      ['mostrar_boton_pdf_tracking', mostrar_boton_pdf_tracking ? 'true' : 'false'],
      ['mostrar_boton_whatsapp_tracking', mostrar_boton_whatsapp_tracking ? 'true' : 'false'],
      ['mostrar_boton_copiar_tracking', mostrar_boton_copiar_tracking ? 'true' : 'false'],
      ['mostrar_seccion_features', mostrar_seccion_features ? 'true' : 'false'],
      ['mostrar_seccion_stats', mostrar_seccion_stats ? 'true' : 'false'],
      ['mostrar_seccion_como_funciona', mostrar_seccion_como_funciona ? 'true' : 'false'],
      ['mostrar_seccion_cta', mostrar_seccion_cta ? 'true' : 'false']
    ];
    
    for (const [clave, valor] of updates) {
      await db.query(
        'UPDATE configuracion_sistema SET valor = ?, modificado_por = ? WHERE clave = ?',
        [valor, req.session.userId, clave]
      );
    }
    
    console.log('✅ Configuración de tracking actualizada');
    res.redirect('/configuracion?success=tracking_actualizado');
  } catch (error) {
    console.error('Error al actualizar tracking:', error);
    res.redirect('/configuracion?error=error_servidor');
  }
});

// ============================================
// ⬅️ NUEVAS RUTAS: GESTIÓN DE DIRECCIONES DE EMPRESA
// ============================================

// Crear nueva dirección de empresa
router.post('/direcciones/nueva', async (req, res) => {
  try {
    const { alias, calle, colonia, ciudad, estado, cp, referencia, es_predeterminada, tipo } = req.body;

    // Validar campos obligatorios
    if (!alias || !calle || !colonia || !ciudad || !estado || !cp) {
      return res.redirect('/configuracion?error=campos_faltantes');
    }

    const tipoFinal = ['origen','destino','ambos'].includes(tipo) ? tipo : 'origen';

    // Si se marca como predeterminada, quitar predeterminada de las demás del mismo tipo
    if (es_predeterminada === 'on') {
      await db.query('UPDATE direcciones_empresa SET es_predeterminada = 0');
    }

    // Insertar nueva dirección
    await db.query(`
      INSERT INTO direcciones_empresa
      (alias, tipo, calle, colonia, ciudad, estado, cp, referencia, es_predeterminada, activa)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      alias,
      tipoFinal,
      calle,
      colonia,
      ciudad,
      estado,
      cp,
      referencia || null,
      es_predeterminada === 'on' ? 1 : 0
    ]);
    
    console.log('✅ Dirección de empresa creada:', alias);
    res.redirect('/configuracion?success=direccion_creada');
    
  } catch (error) {
    console.error('Error al crear dirección:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.redirect('/configuracion?error=alias_duplicado');
    }
    
    res.redirect('/configuracion?error=error_servidor');
  }
});

// Editar dirección de empresa
router.post('/direcciones/:id/editar', async (req, res) => {
  try {
    const { id } = req.params;
    const { alias, calle, colonia, ciudad, estado, cp, referencia, es_predeterminada, tipo } = req.body;

    // Validar campos obligatorios
    if (!alias || !calle || !colonia || !ciudad || !estado || !cp) {
      return res.redirect('/configuracion?error=campos_faltantes');
    }

    const tipoFinal = ['origen','destino','ambos'].includes(tipo) ? tipo : 'origen';

    // Si se marca como predeterminada, quitar predeterminada de las demás
    if (es_predeterminada === 'on') {
      await db.query('UPDATE direcciones_empresa SET es_predeterminada = 0');
    }

    // Actualizar dirección
    await db.query(`
      UPDATE direcciones_empresa
      SET alias = ?, tipo = ?, calle = ?, colonia = ?, ciudad = ?, estado = ?, cp = ?, referencia = ?, es_predeterminada = ?
      WHERE id = ?
    `, [
      alias,
      tipoFinal,
      calle,
      colonia,
      ciudad,
      estado,
      cp,
      referencia || null,
      es_predeterminada === 'on' ? 1 : 0,
      id
    ]);
    
    console.log('✅ Dirección actualizada:', id);
    res.redirect('/configuracion?success=direccion_actualizada');
    
  } catch (error) {
    console.error('Error al editar dirección:', error);
    res.redirect('/configuracion?error=error_servidor');
  }
});

// Eliminar dirección de empresa (soft delete)
router.post('/direcciones/:id/eliminar', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar que no sea la única dirección
    const [count] = await db.query(
      'SELECT COUNT(*) as total FROM direcciones_empresa WHERE activa = 1'
    );
    
    if (count[0].total <= 1) {
      return res.redirect('/configuracion?error=ultima_direccion');
    }
    
    // Soft delete
    await db.query('UPDATE direcciones_empresa SET activa = 0 WHERE id = ?', [id]);
    
    // Si era predeterminada, marcar otra como predeterminada
    const [predeterminada] = await db.query(
      'SELECT id FROM direcciones_empresa WHERE activa = 1 ORDER BY id ASC LIMIT 1'
    );
    
    if (predeterminada.length > 0) {
      await db.query(
        'UPDATE direcciones_empresa SET es_predeterminada = 1 WHERE id = ?',
        [predeterminada[0].id]
      );
    }
    
    console.log('✅ Dirección eliminada:', id);
    res.redirect('/configuracion?success=direccion_eliminada');
    
  } catch (error) {
    console.error('Error al eliminar dirección:', error);
    res.redirect('/configuracion?error=error_servidor');
  }
});

// Marcar dirección como predeterminada
router.post('/direcciones/:id/predeterminada', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Quitar predeterminada de todas
    await db.query('UPDATE direcciones_empresa SET es_predeterminada = 0');
    
    // Marcar esta como predeterminada
    await db.query('UPDATE direcciones_empresa SET es_predeterminada = 1 WHERE id = ?', [id]);
    
    console.log('✅ Dirección marcada como predeterminada:', id);
    res.redirect('/configuracion?success=predeterminada_actualizada');
    
  } catch (error) {
    console.error('Error al marcar predeterminada:', error);
    res.redirect('/configuracion?error=error_servidor');
  }
});



// ============================================
// IMPORTAR BODEGAS DESDE CSV (admin/superusuario)
// ============================================
router.post('/direcciones/importar-csv', isAuthenticated, uploadCSV.single('csv_file'), async (req, res) => {
  try {
    if (!['admin', 'superusuario'].includes(req.session.userRole)) {
      return res.status(403).json({ success: false, error: 'Sin permisos' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Archivo no recibido' });
    }

    // Strip BOM and normalize line endings
    const content = req.file.buffer.toString('utf8').replace(/^\uFEFF/, '').replace(/\r/g, '');
    const lines = content.split('\n').map(l => l.trim()).filter(l => l);

    if (lines.length === 0) {
      return res.status(400).json({ success: false, error: 'El archivo está vacío' });
    }

    // Auto-detect separator (comma vs semicolon — Excel en español usa ';')
    const sep = detectSeparator(lines[0]);
    console.log(`📋 CSV bodegas import: ${lines.length} líneas, separador: '${sep}'`);

    const firstLineLower = lines[0].toLowerCase();
    const dataLines = (firstLineLower.includes('alias') || firstLineLower.includes('calle') || firstLineLower.includes('nombre')) ? lines.slice(1) : lines;

    let imported = 0;
    let errores = 0;

    for (const line of dataLines) {
      const parts = parseCSVLine(line, sep);
      const [alias, calle, colonia, ciudad, estado, cp, referencia] = parts;

      if (!alias || !calle || !colonia || !ciudad || !estado || !cp) {
        errores++;
        continue;
      }

      try {
        await db.query(`
          INSERT INTO direcciones_empresa
          (alias, calle, colonia, ciudad, estado, cp, referencia, es_predeterminada, activa)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1)
        `, [alias, calle, colonia, ciudad, estado, cp, referencia || null]);
        imported++;
      } catch (err) {
        errores++;
        console.error('Error insertando bodega CSV:', err.message, '— alias:', alias);
      }
    }

    res.json({ success: true, imported, errores, separador: sep, totalLineas: dataLines.length });

  } catch (error) {
    console.error('Error al importar CSV bodegas:', error);
    res.status(500).json({ success: false, error: 'Error al procesar el archivo' });
  }
});

// ============================================
// API: OBTENER DIRECCIONES DE EMPRESA (JSON)
// ============================================
router.get('/api/direcciones', isAuthenticated, async (req, res) => {
  try {
    const { tipo } = req.query;
    let query = 'SELECT * FROM direcciones_empresa WHERE activa = 1';
    if (tipo === 'origen') {
      query += " AND tipo IN ('origen','ambos')";
    } else if (tipo === 'destino') {
      query += " AND tipo IN ('destino','ambos')";
    }
    query += ' ORDER BY es_predeterminada DESC, alias ASC';
    const [direcciones] = await db.query(query);
    res.json({ success: true, direcciones });
  } catch (error) {
    console.error('Error al obtener direcciones empresa:', error);
    res.status(500).json({ success: false, message: 'Error al cargar direcciones' });
  }
});

// ============================================
// SUBIR LOGO DE EMPRESA
// ============================================
router.post('/logo/upload', uploadLogo.single('logo_file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.redirect('/configuracion?error=archivo_requerido');
    }

    const logoUrl = '/images/' + req.file.filename;

    await db.query(
      'UPDATE configuracion_sistema SET valor = ?, modificado_por = ? WHERE clave = ?',
      [logoUrl, req.session.userId, 'empresa_logo_url']
    );

    console.log('✅ Logo actualizado:', logoUrl);
    res.redirect('/configuracion?success=logo_actualizado');
  } catch (error) {
    console.error('Error al subir logo:', error);
    res.redirect('/configuracion?error=error_servidor');
  }
});

// ============================================
// SUBIR LOGO B&N (para etiqueta)
// ============================================
router.post('/logo-bw/upload', uploadLogoBw.single('logo_bw_file'), async (req, res) => {
  try {
    if (!req.file) return res.redirect('/configuracion?error=archivo_requerido');
    const logoUrl = '/images/' + req.file.filename;
    await db.query(
      `INSERT INTO configuracion_sistema (clave, valor, tipo, categoria, descripcion, modificado_por)
       VALUES ('empresa_logo_bw_url', ?, 'texto', 'empresa', 'Logo blanco/negro para etiqueta térmica', ?)
       ON DUPLICATE KEY UPDATE valor = VALUES(valor), modificado_por = VALUES(modificado_por)`,
      [logoUrl, req.session.userId]
    );
    res.redirect('/configuracion?success=logo_bw_actualizado');
  } catch (error) {
    console.error('Error al subir logo B&N:', error);
    res.redirect('/configuracion?error=error_servidor');
  }
});

// GET /logo-bw/eliminar
router.get('/logo-bw/eliminar', async (req, res) => {
  try {
    await db.query(
      `INSERT INTO configuracion_sistema (clave, valor, tipo, categoria, descripcion, modificado_por)
       VALUES ('empresa_logo_bw_url', '', 'texto', 'empresa', 'Logo blanco/negro para etiqueta térmica', ?)
       ON DUPLICATE KEY UPDATE valor = '', modificado_por = VALUES(modificado_por)`,
      [req.session.userId]
    );
    res.redirect('/configuracion?success=logo_bw_eliminado');
  } catch (error) {
    console.error('Error al eliminar logo B&N:', error);
    res.redirect('/configuracion?error=error_servidor');
  }
});

// ============================================
// ACTUALIZAR TOGGLES DE ETIQUETA TÉRMICA
// ============================================
router.post('/etiqueta', async (req, res) => {
  try {
    const {
      etiqueta_mostrar_logo,
      etiqueta_mostrar_eslogan,
      etiqueta_mostrar_telefono,
      etiqueta_mostrar_telefono_adicional,
      etiqueta_mostrar_email,
      etiqueta_mostrar_sitio_web,
      etiqueta_mostrar_rfc,
      etiqueta_mostrar_direccion_fiscal,
      etiqueta_mostrar_barcode,
      etiqueta_mostrar_qr,
      etiqueta_mostrar_ruta,
      etiqueta_mostrar_descripcion
    } = req.body;

    // Checkbox marcado = 'on', desmarcado = 'false' (del hidden input)
    // El string 'false' es truthy en JS, hay que comparar explícitamente
    const checked = (val) => val === 'on' || (Array.isArray(val) && val.includes('on'));

    const updates = [
      ['etiqueta_mostrar_logo',               checked(etiqueta_mostrar_logo)               ? 'true' : 'false'],
      ['etiqueta_mostrar_eslogan',             checked(etiqueta_mostrar_eslogan)            ? 'true' : 'false'],
      ['etiqueta_mostrar_telefono',            checked(etiqueta_mostrar_telefono)           ? 'true' : 'false'],
      ['etiqueta_mostrar_telefono_adicional',  checked(etiqueta_mostrar_telefono_adicional) ? 'true' : 'false'],
      ['etiqueta_mostrar_email',               checked(etiqueta_mostrar_email)              ? 'true' : 'false'],
      ['etiqueta_mostrar_sitio_web',           checked(etiqueta_mostrar_sitio_web)          ? 'true' : 'false'],
      ['etiqueta_mostrar_rfc',                 checked(etiqueta_mostrar_rfc)                ? 'true' : 'false'],
      ['etiqueta_mostrar_direccion_fiscal',    checked(etiqueta_mostrar_direccion_fiscal)   ? 'true' : 'false'],
      ['etiqueta_mostrar_barcode',             checked(etiqueta_mostrar_barcode)            ? 'true' : 'false'],
      ['etiqueta_mostrar_qr',                  checked(etiqueta_mostrar_qr)                 ? 'true' : 'false'],
      ['etiqueta_mostrar_ruta',                checked(etiqueta_mostrar_ruta)               ? 'true' : 'false'],
      ['etiqueta_mostrar_descripcion',         checked(etiqueta_mostrar_descripcion)        ? 'true' : 'false']
    ];

    for (const [clave, valor] of updates) {
      await db.query(`
        INSERT INTO configuracion_sistema (clave, valor, tipo, categoria, descripcion, modificado_por)
        VALUES (?, ?, 'boolean', 'etiqueta', ?, ?)
        ON DUPLICATE KEY UPDATE valor = ?, modificado_por = ?
      `, [clave, valor, `Toggle ${clave}`, req.session.userId, valor, req.session.userId]);
    }

    console.log('✅ Toggles de etiqueta actualizados');
    res.redirect('/configuracion?success=etiqueta_actualizada');
  } catch (error) {
    console.error('Error al actualizar toggles etiqueta:', error);
    res.redirect('/configuracion?error=error_servidor');
  }
});

// Guardar página de inicio del usuario (accesible por cualquier rol interno)
router.post('/pagina-inicio', async (req, res) => {
  try {
    const rutas_validas = ['/dashboard', '/envios', '/envios-retrasados', '/historial', '/clientes'];
    const { pagina_inicio } = req.body;

    if (!rutas_validas.includes(pagina_inicio)) {
      return res.redirect('/configuracion?error=pagina_invalida');
    }

    await db.query(
      'UPDATE usuarios SET pagina_inicio = ? WHERE id = ?',
      [pagina_inicio, req.session.userId]
    );

    res.redirect('/configuracion?success=pagina_inicio_guardada&tab=pagina-inicio');
  } catch (error) {
    console.error('Error al guardar página de inicio:', error);
    res.redirect('/configuracion?error=error_servidor&tab=pagina-inicio');
  }
});

// ============================================
// TEMPLATES DE ETIQUETA
// ============================================

// Campos que admite un template
const TEMPLATE_FIELDS = [
  'mostrar_logo','mostrar_eslogan','mostrar_telefono','mostrar_telefono_adicional',
  'mostrar_email','mostrar_sitio_web','mostrar_rfc','mostrar_direccion_fiscal',
  'mostrar_barcode','mostrar_qr','mostrar_ruta','mostrar_descripcion',
  'mostrar_dest_contacto','mostrar_dest_telefono',
  'mostrar_dest_nombre','mostrar_dest_direccion','mostrar_dest_referencia',
  'obligatorio_logo','obligatorio_eslogan','obligatorio_telefono','obligatorio_telefono_adicional',
  'obligatorio_email','obligatorio_sitio_web','obligatorio_rfc','obligatorio_direccion_fiscal',
  'obligatorio_barcode','obligatorio_qr','obligatorio_ruta','obligatorio_descripcion',
  'obligatorio_dest_contacto','obligatorio_dest_telefono',
  'obligatorio_dest_nombre','obligatorio_dest_direccion','obligatorio_dest_referencia',
  'mostrar_alias_ruta','obligatorio_alias_ruta',
  'mostrar_peso_total','obligatorio_peso_total',
  'mostrar_peso_item','obligatorio_peso_item'
];
// Campos de texto editables del template de etiqueta (no son boolean)
const TEMPLATE_TEXT_FIELDS = [
  'texto_entregar_a','texto_peso','texto_peso_item','texto_entrega_estimada','texto_ref_cliente',
  'texto_descripcion','texto_fecha_emision','texto_etiqueta'
];
// Campos de tamaño (TINYINT, NULL = usar default CSS)
const TEMPLATE_SIZE_FIELDS = [
  'size_tracking','size_ruta_ciudad','size_dest_nombre','size_dest_direccion','size_empresa_nombre',
  'size_eslogan','size_tipo_servicio','size_detalle_valor','size_descripcion','size_dest_contacto',
  'size_barra_contacto','size_ruta_etiqueta','size_detalle_etiqueta','size_cab_fecha','size_cab_num'
];

// API: listar templates (JSON)
router.get('/api/etiqueta/templates', isAuthenticated, async (req, res) => {
  try {
    const templates = await obtenerTemplates();
    res.json({ success: true, templates });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener templates' });
  }
});

// Crear nuevo template (admin + superusuario)
router.post('/etiqueta/templates/nuevo', isAuthenticated, async (req, res) => {
  const rol = req.session.userRole;
  if (rol !== 'admin' && rol !== 'superusuario') {
    return res.redirect('/configuracion?error=sin_permiso&tab=etiqueta');
  }
  try {
    const { nombre } = req.body;
    if (!nombre || nombre.trim() === '') {
      return res.redirect('/configuracion?error=nombre_requerido&tab=etiqueta');
    }

    const values = {};
    for (const f of TEMPLATE_FIELDS) {
      values[f] = req.body[f] === 'on' ? 1 : 0;
    }

    const boolCols  = TEMPLATE_FIELDS.join(', ');
    const textCols  = TEMPLATE_TEXT_FIELDS.join(', ');
    const sizeCols  = TEMPLATE_SIZE_FIELDS.join(', ');
    const boolVals  = TEMPLATE_FIELDS.map(f => values[f]);
    const textVals  = TEMPLATE_TEXT_FIELDS.map(f => req.body[f] || null);
    const sizeVals  = TEMPLATE_SIZE_FIELDS.map(f => parseInt(req.body[f]) || null);
    const placeholders = [...TEMPLATE_FIELDS, ...TEMPLATE_TEXT_FIELDS, ...TEMPLATE_SIZE_FIELDS].map(() => '?').join(', ');

    await db.query(`
      INSERT INTO etiqueta_templates (nombre, ${boolCols}, ${textCols}, ${sizeCols}, creado_por)
      VALUES (?, ${placeholders}, ?)
    `, [nombre.trim(), ...boolVals, ...textVals, ...sizeVals, req.session.userId]);

    res.redirect('/configuracion?success=template_creado&tab=etiqueta');
  } catch (error) {
    console.error('Error al crear template:', error);
    res.redirect('/configuracion?error=error_servidor&tab=etiqueta');
  }
});

// Guardar template existente (admin + superusuario)
router.post('/etiqueta/templates/:id/guardar', isAuthenticated, async (req, res) => {
  const rol = req.session.userRole;
  if (rol !== 'admin' && rol !== 'superusuario') {
    return res.redirect('/configuracion?error=sin_permiso&tab=etiqueta');
  }
  try {
    const { id } = req.params;
    const { nombre } = req.body;

    const boolSets = TEMPLATE_FIELDS.map(f => `${f} = ?`).join(', ');
    const textSets = TEMPLATE_TEXT_FIELDS.map(f => `${f} = ?`).join(', ');
    const sizeSets = TEMPLATE_SIZE_FIELDS.map(f => `${f} = ?`).join(', ');
    const boolVals = TEMPLATE_FIELDS.map(f => req.body[f] === 'on' ? 1 : 0);
    const textVals = TEMPLATE_TEXT_FIELDS.map(f => req.body[f] || null);
    const sizeVals = TEMPLATE_SIZE_FIELDS.map(f => parseInt(req.body[f]) || null);

    await db.query(
      `UPDATE etiqueta_templates SET nombre = ?, ${boolSets}, ${textSets}, ${sizeSets} WHERE id = ?`,
      [nombre || 'Sin nombre', ...boolVals, ...textVals, ...sizeVals, id]
    );

    res.redirect(`/configuracion?success=template_guardado&tab=etiqueta&tpl=${id}`);
  } catch (error) {
    console.error('Error al guardar template:', error);
    res.redirect(`/configuracion?error=error_servidor&tab=etiqueta&tpl=${id}`);
  }
});

// Eliminar template (solo admin)
router.post('/etiqueta/templates/:id/eliminar', isAuthenticated, async (req, res) => {
  if (req.session.userRole !== 'admin') {
    return res.redirect('/configuracion?error=sin_permiso&tab=etiqueta');
  }
  try {
    const { id } = req.params;
    // Desasignar del template a los clientes que lo usan
    await db.query('UPDATE clientes SET template_etiqueta_id = NULL WHERE template_etiqueta_id = ?', [id]);
    await db.query('DELETE FROM etiqueta_templates WHERE id = ?', [id]);
    res.redirect('/configuracion?success=template_eliminado&tab=etiqueta');
  } catch (error) {
    console.error('Error al eliminar template:', error);
    res.redirect('/configuracion?error=error_servidor&tab=etiqueta');
  }
});

// ============================================
// TEMPLATES DE GUÍA EXPEDIDA
// ============================================

const GUIA_TEMPLATE_FIELDS = [
  'mostrar_logo','mostrar_rfc','mostrar_telefono','mostrar_sitio_web','mostrar_barcode',
  'mostrar_seccion_remitente','mostrar_seccion_facturar','mostrar_seccion_destinatario',
  'mostrar_clausula_seguro','mostrar_retorno_documentos','mostrar_condiciones_pago',
  'mostrar_fecha_emision','mostrar_observaciones','mostrar_fecha_entrega',
  'mostrar_referencia_cliente','mostrar_recibido_por','mostrar_operador',
  'mostrar_firma_final','mostrar_pie_datos','mostrar_disclaimer',
  'mostrar_col_volumen','mostrar_col_peso_facturado','mostrar_col_servicios','mostrar_col_importe',
  'mostrar_obs_operador','mostrar_obs_recibido',
  'obligatorio_logo','obligatorio_rfc','obligatorio_telefono','obligatorio_sitio_web','obligatorio_barcode',
  'obligatorio_seccion_remitente','obligatorio_seccion_facturar','obligatorio_seccion_destinatario',
  'obligatorio_clausula_seguro','obligatorio_retorno_documentos','obligatorio_condiciones_pago',
  'obligatorio_fecha_emision','obligatorio_observaciones','obligatorio_fecha_entrega',
  'obligatorio_referencia_cliente','obligatorio_recibido_por','obligatorio_operador',
  'obligatorio_firma_final','obligatorio_pie_datos','obligatorio_disclaimer',
  'obligatorio_col_volumen','obligatorio_col_peso_facturado','obligatorio_col_servicios','obligatorio_col_importe',
  'obligatorio_obs_operador','obligatorio_obs_recibido',
  'mostrar_remitente_nombre','mostrar_remitente_direccion','mostrar_remitente_telefono',
  'mostrar_facturar_nombre','mostrar_facturar_direccion','mostrar_facturar_contacto','mostrar_facturar_telefono','mostrar_facturar_email','mostrar_facturar_rfc',
  'mostrar_destinatario_nombre','mostrar_destinatario_direccion',
  'obligatorio_remitente_nombre','obligatorio_remitente_direccion','obligatorio_remitente_telefono',
  'obligatorio_facturar_nombre','obligatorio_facturar_direccion','obligatorio_facturar_contacto','obligatorio_facturar_telefono','obligatorio_facturar_email','obligatorio_facturar_rfc',
  'obligatorio_destinatario_nombre','obligatorio_destinatario_direccion'
];

const GUIA_SIZE_FIELDS = [
  'size_guia_titulo','size_tracking_big','size_company_name','size_seccion_content','size_cargo_td',
  'size_guia_servicio','size_seccion_label','size_cargo_th','size_footer_content','size_pago_big','size_msg_row'
];

router.post('/guia/templates/nuevo', isAuthenticated, async (req, res) => {
  const rol = req.session.userRole;
  if (rol !== 'admin' && rol !== 'superusuario') {
    return res.redirect('/configuracion?error=sin_permiso&tab=guia');
  }
  try {
    const { nombre, descripcion_servicio, titulo_guia, mensaje_1, mensaje_2, mensaje_3, mensaje_4,
            etiqueta_col_descripcion, etiqueta_operador,
            etiqueta_obs_operador, etiqueta_recibido_por, etiqueta_obs_recibido } = req.body;
    if (!nombre || nombre.trim() === '') {
      return res.redirect('/configuracion?error=nombre_requerido&tab=guia');
    }
    const cols = [...GUIA_TEMPLATE_FIELDS, ...GUIA_SIZE_FIELDS].join(', ');
    const placeholders = [...GUIA_TEMPLATE_FIELDS, ...GUIA_SIZE_FIELDS].map(() => '?').join(', ');
    const vals = [
      ...GUIA_TEMPLATE_FIELDS.map(() => 1),
      ...GUIA_SIZE_FIELDS.map(() => null)
    ];
    await db.query(
      `INSERT INTO guia_templates (nombre, ${cols}, descripcion_servicio, titulo_guia, mensaje_1, mensaje_2, mensaje_3, mensaje_4, etiqueta_col_descripcion, etiqueta_operador, etiqueta_obs_operador, etiqueta_recibido_por, etiqueta_obs_recibido, creado_por)
       VALUES (?, ${placeholders}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre.trim(), ...vals,
        descripcion_servicio || null, titulo_guia || null,
        mensaje_1 || null, mensaje_2 || null, mensaje_3 || null, mensaje_4 || null,
        etiqueta_col_descripcion || null, etiqueta_operador || null,
        etiqueta_obs_operador || null, etiqueta_recibido_por || null, etiqueta_obs_recibido || null,
        req.session.userId]
    );
    res.redirect('/configuracion?success=guia_template_creado&tab=guia');
  } catch (error) {
    console.error('Error al crear template de guía:', error);
    res.redirect('/configuracion?error=error_servidor&tab=guia');
  }
});

router.post('/guia/templates/:id/guardar', isAuthenticated, async (req, res) => {
  const rol = req.session.userRole;
  if (rol !== 'admin' && rol !== 'superusuario') {
    return res.redirect('/configuracion?error=sin_permiso&tab=guia');
  }
  try {
    const { id } = req.params;
    const { nombre, descripcion_servicio, titulo_guia, mensaje_1, mensaje_2, mensaje_3, mensaje_4,
            etiqueta_col_descripcion, etiqueta_operador,
            etiqueta_obs_operador, etiqueta_recibido_por, etiqueta_obs_recibido } = req.body;
    const sets = [
      ...GUIA_TEMPLATE_FIELDS.map(f => `${f} = ?`),
      ...GUIA_SIZE_FIELDS.map(f => `${f} = ?`)
    ].join(', ');
    const vals = [
      ...GUIA_TEMPLATE_FIELDS.map(f => req.body[f] === 'on' ? 1 : 0),
      ...GUIA_SIZE_FIELDS.map(f => parseInt(req.body[f]) || null)
    ];
    await db.query(
      `UPDATE guia_templates SET nombre = ?, ${sets},
        descripcion_servicio = ?, titulo_guia = ?,
        mensaje_1 = ?, mensaje_2 = ?, mensaje_3 = ?, mensaje_4 = ?,
        etiqueta_col_descripcion = ?, etiqueta_operador = ?,
        etiqueta_obs_operador = ?, etiqueta_recibido_por = ?, etiqueta_obs_recibido = ?
       WHERE id = ?`,
      [nombre || 'Sin nombre', ...vals,
        descripcion_servicio || null, titulo_guia || null,
        mensaje_1 || null, mensaje_2 || null, mensaje_3 || null, mensaje_4 || null,
        etiqueta_col_descripcion || null, etiqueta_operador || null,
        etiqueta_obs_operador || null, etiqueta_recibido_por || null, etiqueta_obs_recibido || null,
        id]
    );
    res.redirect(`/configuracion?success=guia_template_guardado&tab=guia&tpl=${id}`);
  } catch (error) {
    console.error('Error al guardar template de guía:', error);
    res.redirect(`/configuracion?error=error_servidor&tab=guia&tpl=${id}`);
  }
});

router.post('/guia/templates/:id/eliminar', isAuthenticated, async (req, res) => {
  if (req.session.userRole !== 'admin') {
    return res.redirect('/configuracion?error=sin_permiso&tab=guia');
  }
  try {
    const { id } = req.params;
    await db.query('UPDATE clientes SET template_guia_id = NULL WHERE template_guia_id = ?', [id]);
    await db.query('DELETE FROM guia_templates WHERE id = ?', [id]);
    res.redirect('/configuracion?success=guia_template_eliminado&tab=guia');
  } catch (error) {
    console.error('Error al eliminar template de guía:', error);
    res.redirect('/configuracion?error=error_servidor&tab=guia');
  }
});

// ============================================
// CATÁLOGO: TIPOS DE EMPAQUE
// ============================================

// Nuevo tipo de empaque (admin + superusuario)
router.post('/catalogos/tipos-empaques/nuevo', isAuthenticated, async (req, res) => {
  const rol = req.session.userRole;
  if (rol !== 'admin' && rol !== 'superusuario') {
    return res.redirect('/configuracion?tab=catalogos&error=sin_permiso');
  }
  try {
    const nombre = (req.body.nombre || '').trim();
    if (!nombre) {
      return res.redirect('/configuracion?tab=catalogos&error=nombre_requerido');
    }
    const [[maxRow]] = await db.query('SELECT COALESCE(MAX(orden), 0) + 1 AS siguiente FROM tipos_empaques');
    await db.query(
      'INSERT INTO tipos_empaques (nombre, orden) VALUES (?, ?)',
      [nombre, maxRow.siguiente]
    );
    res.redirect('/configuracion?tab=catalogos&success=tipo_empaque_creado');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.redirect('/configuracion?tab=catalogos&error=nombre_duplicado');
    }
    console.error('Error al crear tipo empaque:', error);
    res.redirect('/configuracion?tab=catalogos&error=error_servidor');
  }
});

// Editar tipo de empaque (admin + superusuario)
router.post('/catalogos/tipos-empaques/:id/editar', isAuthenticated, async (req, res) => {
  const rol = req.session.userRole;
  if (rol !== 'admin' && rol !== 'superusuario') {
    return res.redirect('/configuracion?tab=catalogos&error=sin_permiso');
  }
  try {
    const { id } = req.params;
    const nombre = (req.body.nombre || '').trim();
    if (!nombre) {
      return res.redirect('/configuracion?tab=catalogos&error=nombre_requerido');
    }
    await db.query(
      'UPDATE tipos_empaques SET nombre = ? WHERE id = ?',
      [nombre, id]
    );
    res.redirect('/configuracion?tab=catalogos&success=tipo_empaque_actualizado');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.redirect('/configuracion?tab=catalogos&error=nombre_duplicado');
    }
    console.error('Error al editar tipo empaque:', error);
    res.redirect('/configuracion?tab=catalogos&error=error_servidor');
  }
});

// Eliminar tipo de empaque (solo admin)
router.post('/catalogos/tipos-empaques/:id/eliminar', isAuthenticated, async (req, res) => {
  if (req.session.userRole !== 'admin') {
    return res.redirect('/configuracion?tab=catalogos&error=sin_permiso');
  }
  try {
    const { id } = req.params;
    await db.query('DELETE FROM tipos_empaques WHERE id = ?', [id]);
    res.redirect('/configuracion?tab=catalogos&success=tipo_empaque_eliminado');
  } catch (error) {
    console.error('Error al eliminar tipo empaque:', error);
    res.redirect('/configuracion?tab=catalogos&error=error_servidor');
  }
});

// Toggle activo tipo de empaque (admin + superusuario)
router.post('/catalogos/tipos-empaques/:id/toggle', isAuthenticated, async (req, res) => {
  const rol = req.session.userRole;
  if (rol !== 'admin' && rol !== 'superusuario') {
    return res.redirect('/configuracion?tab=catalogos&error=sin_permiso');
  }
  try {
    const { id } = req.params;
    await db.query(
      'UPDATE tipos_empaques SET activo = NOT activo WHERE id = ?',
      [id]
    );
    res.redirect('/configuracion?tab=catalogos&success=tipo_empaque_actualizado');
  } catch (error) {
    console.error('Error al toggle tipo empaque:', error);
    res.redirect('/configuracion?tab=catalogos&error=error_servidor');
  }
});

// Mover tipo de empaque arriba/abajo (admin + superusuario)
router.post('/catalogos/tipos-empaques/:id/mover', isAuthenticated, async (req, res) => {
  const rol = req.session.userRole;
  if (rol !== 'admin' && rol !== 'superusuario') {
    return res.redirect('/configuracion?tab=catalogos&error=sin_permiso');
  }
  try {
    const { id } = req.params;
    const { direccion } = req.body; // 'arriba' o 'abajo'

    const [[actual]] = await db.query('SELECT id, orden FROM tipos_empaques WHERE id = ?', [id]);
    if (!actual) return res.redirect('/configuracion?tab=catalogos');

    // Buscar el vecino más cercano en la dirección indicada
    let vecinos;
    if (direccion === 'arriba') {
      [vecinos] = await db.query(
        'SELECT id, orden FROM tipos_empaques WHERE orden < ? ORDER BY orden DESC LIMIT 1',
        [actual.orden]
      );
    } else {
      [vecinos] = await db.query(
        'SELECT id, orden FROM tipos_empaques WHERE orden > ? ORDER BY orden ASC LIMIT 1',
        [actual.orden]
      );
    }

    if (vecinos.length === 0) return res.redirect('/configuracion?tab=catalogos');
    const vecino = vecinos[0];

    // Intercambiar órdenes
    await db.query('UPDATE tipos_empaques SET orden = ? WHERE id = ?', [vecino.orden, actual.id]);
    await db.query('UPDATE tipos_empaques SET orden = ? WHERE id = ?', [actual.orden, vecino.id]);

    res.redirect('/configuracion?tab=catalogos');
  } catch (error) {
    console.error('Error al mover tipo empaque:', error);
    res.redirect('/configuracion?tab=catalogos&error=error_servidor');
  }
});

module.exports = router;