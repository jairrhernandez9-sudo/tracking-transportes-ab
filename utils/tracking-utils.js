// =====================================================
// UTILIDADES PARA TRACKING PERSONALIZADO
// Sistema de Prefijos Inteligente
// =====================================================

const db = require('../config/database');

/**
 * Genera un prefijo basado en el nombre de la empresa
 * Extrae las primeras letras significativas
 * 
 * @param {string} nombreEmpresa - Nombre de la empresa
 * @returns {string} Prefijo generado en mayúsculas (ej: "ITP")
 */
function generarPrefijoBase(nombreEmpresa) {
  if (!nombreEmpresa || nombreEmpresa.trim() === '') {
    return 'CLI';
  }

  // Eliminar caracteres especiales, dejar solo letras
  const limpio = nombreEmpresa.replace(/[^A-Za-z\s]/g, '').trim();
  
  if (limpio === '') {
    return 'CLI';
  }

  // Obtener palabras
  const palabras = limpio.split(/\s+/).filter(p => p.length > 0);
  
  let prefijo = '';
  
  // Tomar primera letra de cada palabra (mínimo 3 letras)
  if (palabras.length >= 3) {
    prefijo = palabras
      .slice(0, 3)
      .map(p => p.charAt(0))
      .join('')
      .toUpperCase();
  } else if (palabras.length > 0) {
    // Si hay pocas palabras, tomar más letras
    prefijo = palabras.join('').substring(0, 3).toUpperCase();
  }
  
  return prefijo || 'CLI';
}

/**
 * Verifica si un prefijo está disponible
 * 
 * @param {string} prefijo - Prefijo a verificar
 * @returns {Promise<boolean>} true si está disponible
 */
async function prefijoDisponible(prefijo) {
  try {
    const [result] = await db.query(
      'SELECT COUNT(*) as count FROM clientes WHERE prefijo_tracking = ?',
      [prefijo.toUpperCase()]
    );
    return result[0].count === 0;
  } catch (error) {
    console.error('Error verificando prefijo:', error);
    throw error;
  }
}

/**
 * Genera un prefijo único, manejando colisiones
 * Si existe ITP, prueba ITP2, ITP3, ITPA, ITPB, etc.
 * 
 * @param {string} nombreEmpresa - Nombre de la empresa
 * @returns {Promise<string>} Prefijo único disponible
 */
async function generarPrefijoUnico(nombreEmpresa) {
  const prefijoBase = generarPrefijoBase(nombreEmpresa);
  
  // Verificar si el prefijo base está disponible
  const disponible = await prefijoDisponible(prefijoBase);
  
  if (disponible) {
    return prefijoBase;
  }
  
  // Si ya existe, generar alternativas
  let sufijo = 2;
  let prefijoAlternativo;
  
  // Fase 1: Agregar números (ITP2, ITP3, ..., ITP9)
  while (sufijo <= 9) {
    prefijoAlternativo = `${prefijoBase}${sufijo}`;
    
    const disponible = await prefijoDisponible(prefijoAlternativo);
    if (disponible) {
      return prefijoAlternativo;
    }
    
    sufijo++;
  }
  
  // Fase 2: Agregar letras (ITPA, ITPB, ITPC, ...)
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let i = 0; i < letras.length; i++) {
    prefijoAlternativo = `${prefijoBase}${letras[i]}`;
    
    const disponible = await prefijoDisponible(prefijoAlternativo);
    if (disponible) {
      return prefijoAlternativo;
    }
  }
  
  // Fase 3: Si todo falla, usar timestamp (muy improbable)
  return `${prefijoBase}${Date.now().toString().slice(-3)}`;
}

/**
 * Genera el siguiente número de tracking para un cliente
 * Formato: PREFIJO-NNNNNOD2603
 *   PREFIJO-NNNNN = prefijo del cliente + contador incremental
 *   O             = primera letra de la ciudad de origen
 *   D             = primera letra de la ciudad de destino
 *   26            = día del mes (2 dígitos)
 *   03            = número de items del envío (2 dígitos)
 *
 * @param {number} clienteId     - ID del cliente
 * @param {string} origenCiudad  - Ciudad de origen del envío
 * @param {string} destinoCiudad - Ciudad de destino del envío
 * @param {number} numItems      - Cantidad de items/líneas del envío
 * @returns {Promise<string>} Número de tracking completo (ej: "MDS-00030TO2603")
 */
async function generarSiguienteTracking(clienteId, origenCiudad = '', destinoCiudad = '', numItems = 0) {
  try {
    // Obtener información del cliente
    const [cliente] = await db.query(
      'SELECT prefijo_tracking, ultimo_numero_tracking FROM clientes WHERE id = ?',
      [clienteId]
    );

    if (cliente.length === 0) {
      throw new Error(`Cliente con ID ${clienteId} no encontrado`);
    }

    const { prefijo_tracking, ultimo_numero_tracking } = cliente[0];

    // Incrementar el contador
    const nuevoNumero = ultimo_numero_tracking + 1;

    // Actualizar el contador en la base de datos
    await db.query(
      'UPDATE clientes SET ultimo_numero_tracking = ? WHERE id = ?',
      [nuevoNumero, clienteId]
    );

    // Formatear el número con ceros a la izquierda (mínimo 5 dígitos)
    const numeroFormateado = nuevoNumero.toString().padStart(5, '0');

    // Primera letra de origen y destino (mayúscula, 'X' si vacío)
    const letraOrigen  = (origenCiudad  || '').trim().charAt(0).toUpperCase() || 'X';
    const letraDestino = (destinoCiudad || '').trim().charAt(0).toUpperCase() || 'X';

    // Día del mes (2 dígitos)
    const dia = new Date().getDate().toString().padStart(2, '0');

    // Número de items del envío (2 dígitos)
    const items = numItems.toString().padStart(2, '0');

    // Retornar el tracking completo
    return `${prefijo_tracking}-${numeroFormateado}${letraOrigen}${letraDestino}${dia}${items}`;

  } catch (error) {
    console.error('Error generando tracking:', error);
    throw error;
  }
}

/**
 * Valida formato de prefijo
 * 
 * @param {string} prefijo - Prefijo a validar
 * @returns {object} { valido: boolean, error: string }
 */
function validarFormatoPrefijo(prefijo) {
  // Validar que no esté vacío
  if (!prefijo || prefijo.trim() === '') {
    return { valido: false, error: 'El prefijo no puede estar vacío' };
  }
  
  const prefijoLimpio = prefijo.trim().toUpperCase();
  
  // ⬅️ VALIDAR LONGITUD: mínimo 2, máximo 10
  if (prefijoLimpio.length < 2) {
    return { valido: false, error: 'El prefijo debe tener al menos 2 caracteres' };
  }
  
  if (prefijoLimpio.length > 10) {
    return { valido: false, error: 'El prefijo no puede tener más de 10 caracteres' };
  }
  
  // Validar que solo contenga letras y números
  if (!/^[A-Z0-9]+$/.test(prefijoLimpio)) {
    return { valido: false, error: 'El prefijo solo puede contener letras y números (sin espacios ni caracteres especiales)' };
  }
  
  return { valido: true };
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  generarPrefijoBase,
  prefijoDisponible,
  generarPrefijoUnico,
  generarSiguienteTracking,
  validarFormatoPrefijo
};