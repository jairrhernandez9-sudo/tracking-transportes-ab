const db = require('../config/database');

/**
 * Registra una acción en el log de actividad del sistema.
 *
 * @param {object} req        - Request de Express (para sacar sesión e IP)
 * @param {object} opts
 * @param {string} opts.accion       - Código de acción: ENVIO_CREADO, LOGIN, etc.
 * @param {string} opts.entidad      - Nombre de la entidad: envio, cliente, usuario, config
 * @param {number} [opts.entidadId]  - ID del registro afectado
 * @param {string} opts.descripcion  - Texto legible para mostrar en el historial
 * @param {object} [opts.detalle]    - Datos extra en JSON (campos cambiados, etc.)
 */
async function registrarActividad(req, { accion, entidad, entidadId, descripcion, detalle } = {}) {
  try {
    const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
    await db.query(
      `INSERT INTO actividad_log
         (usuario_id, usuario_nombre, usuario_rol, accion, entidad, entidad_id, descripcion, detalle, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.session.userId   || null,
        req.session.userName || 'Sistema',
        req.session.userRole || 'sistema',
        accion,
        entidad,
        entidadId || null,
        descripcion,
        detalle ? JSON.stringify(detalle) : null,
        ip || null,
      ]
    );
  } catch (err) {
    // No interrumpe la operación principal si falla el log
    console.error('[actividad] Error al registrar:', err.message);
  }
}

module.exports = { registrarActividad };
