const express = require('express');
const path = require('path');
const session = require('express-session');
require('dotenv').config();
const db = require('./config/database');

// Tabla de asignación operador → cliente
db.query(`
  CREATE TABLE IF NOT EXISTS cliente_operadores (
    cliente_id INT NOT NULL,
    usuario_id INT NOT NULL,
    PRIMARY KEY (cliente_id, usuario_id)
  )
`).catch(() => {});

// Migraciones de columnas — .catch() silencia "duplicate column" (ER_DUP_FIELDNAME)
db.query(`ALTER TABLE usuarios ADD COLUMN pagina_inicio VARCHAR(50) NOT NULL DEFAULT 'dashboard'`).catch(() => {});
db.query(`ALTER TABLE usuarios ADD COLUMN ultimo_cliente_id INT NULL`).catch(() => {});
db.query(`ALTER TABLE usuarios ADD COLUMN alias VARCHAR(80) NULL`).catch(() => {});

// Migración: textos editables en guia_templates
db.query(`ALTER TABLE guia_templates ADD COLUMN descripcion_servicio VARCHAR(200) NULL`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN titulo_guia VARCHAR(100) NULL`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN mensaje_1 TEXT NULL`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN mensaje_2 TEXT NULL`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN mensaje_3 TEXT NULL`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN mensaje_4 TEXT NULL`).catch(() => {});

// Migración: sub-campos de secciones en guia_templates
db.query(`ALTER TABLE guia_templates ADD COLUMN mostrar_remitente_nombre TINYINT(1) DEFAULT 1`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN mostrar_remitente_direccion TINYINT(1) DEFAULT 1`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN mostrar_remitente_telefono TINYINT(1) DEFAULT 1`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN mostrar_facturar_nombre TINYINT(1) DEFAULT 1`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN mostrar_facturar_direccion TINYINT(1) DEFAULT 1`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN mostrar_facturar_contacto TINYINT(1) DEFAULT 1`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN mostrar_facturar_telefono TINYINT(1) DEFAULT 1`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN mostrar_facturar_email TINYINT(1) DEFAULT 1`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN mostrar_facturar_rfc TINYINT(1) DEFAULT 1`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN mostrar_destinatario_nombre TINYINT(1) DEFAULT 1`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN mostrar_destinatario_direccion TINYINT(1) DEFAULT 1`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN obligatorio_remitente_nombre TINYINT(1) DEFAULT 0`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN obligatorio_remitente_direccion TINYINT(1) DEFAULT 0`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN obligatorio_remitente_telefono TINYINT(1) DEFAULT 0`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN obligatorio_facturar_nombre TINYINT(1) DEFAULT 0`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN obligatorio_facturar_direccion TINYINT(1) DEFAULT 0`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN obligatorio_facturar_contacto TINYINT(1) DEFAULT 0`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN obligatorio_facturar_telefono TINYINT(1) DEFAULT 0`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN obligatorio_facturar_email TINYINT(1) DEFAULT 0`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN obligatorio_facturar_rfc TINYINT(1) DEFAULT 0`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN obligatorio_destinatario_nombre TINYINT(1) DEFAULT 0`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN obligatorio_destinatario_direccion TINYINT(1) DEFAULT 0`).catch(() => {});

// Migración: último lugar de expedición por usuario
db.query(`ALTER TABLE usuarios ADD COLUMN ultimo_lugar_expedicion VARCHAR(200) NULL`).catch(() => {});

// Migración: etiquetas personalizables en guia_templates
db.query(`ALTER TABLE guia_templates ADD COLUMN etiqueta_col_descripcion VARCHAR(200) NULL`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN etiqueta_operador VARCHAR(200) NULL`).catch(() => {});

// Migración: pictogramas
db.query(`
  CREATE TABLE IF NOT EXISTS pictogramas (
    id          INT NOT NULL AUTO_INCREMENT,
    nombre      VARCHAR(100) NOT NULL,
    imagen_url  VARCHAR(500) NOT NULL,
    activo      TINYINT(1) DEFAULT 1,
    orden       INT DEFAULT 0,
    creado_por  INT NULL,
    creado_en   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY fk_picto_creador (creado_por),
    CONSTRAINT picto_ibfk_1 FOREIGN KEY (creado_por) REFERENCES usuarios (id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(() => {});
db.query(`
  CREATE TABLE IF NOT EXISTS envio_pictogramas (
    id             INT NOT NULL AUTO_INCREMENT,
    envio_id       INT NOT NULL,
    pictograma_id  INT NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_envio_picto (envio_id, pictograma_id),
    KEY fk_ep_envio (envio_id),
    KEY fk_ep_picto (pictograma_id),
    CONSTRAINT ep_ibfk_1 FOREIGN KEY (envio_id)      REFERENCES envios (id) ON DELETE CASCADE,
    CONSTRAINT ep_ibfk_2 FOREIGN KEY (pictograma_id) REFERENCES pictogramas (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(() => {});

// Migración: textos editables en etiqueta_templates
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN texto_entregar_a VARCHAR(100) NULL`).catch(() => {});
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN texto_peso VARCHAR(50) NULL`).catch(() => {});
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN texto_entrega_estimada VARCHAR(100) NULL`).catch(() => {});
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN texto_ref_cliente VARCHAR(100) NULL`).catch(() => {});
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN texto_descripcion VARCHAR(100) NULL`).catch(() => {});
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN texto_fecha_emision VARCHAR(100) NULL`).catch(() => {});
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN texto_etiqueta VARCHAR(50) NULL`).catch(() => {});

// Migración: tamaños de texto en etiqueta_templates (TINYINT, NULL = usar default)
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN size_tracking TINYINT UNSIGNED NULL`).catch(() => {});
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN size_ruta_ciudad TINYINT UNSIGNED NULL`).catch(() => {});
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN size_dest_nombre TINYINT UNSIGNED NULL`).catch(() => {});
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN size_dest_direccion TINYINT UNSIGNED NULL`).catch(() => {});
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN size_empresa_nombre TINYINT UNSIGNED NULL`).catch(() => {});
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN size_eslogan TINYINT UNSIGNED NULL`).catch(() => {});
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN size_tipo_servicio TINYINT UNSIGNED NULL`).catch(() => {});
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN size_detalle_valor TINYINT UNSIGNED NULL`).catch(() => {});
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN size_descripcion TINYINT UNSIGNED NULL`).catch(() => {});
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN size_dest_contacto TINYINT UNSIGNED NULL`).catch(() => {});

// Migración: tamaños de texto en guia_templates
db.query(`ALTER TABLE guia_templates ADD COLUMN size_guia_titulo TINYINT UNSIGNED NULL`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN size_tracking_big TINYINT UNSIGNED NULL`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN size_company_name TINYINT UNSIGNED NULL`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN size_seccion_content TINYINT UNSIGNED NULL`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN size_cargo_td TINYINT UNSIGNED NULL`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN size_guia_servicio TINYINT UNSIGNED NULL`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN size_seccion_label TINYINT UNSIGNED NULL`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN size_cargo_th TINYINT UNSIGNED NULL`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN size_footer_content TINYINT UNSIGNED NULL`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN size_pago_big TINYINT UNSIGNED NULL`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN size_msg_row TINYINT UNSIGNED NULL`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN height_obs_tall SMALLINT UNSIGNED NULL`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN mostrar_obs_operador TINYINT(1) DEFAULT 1`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN obligatorio_obs_operador TINYINT(1) DEFAULT 0`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN mostrar_obs_recibido TINYINT(1) DEFAULT 1`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN obligatorio_obs_recibido TINYINT(1) DEFAULT 0`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN etiqueta_obs_operador VARCHAR(200) NULL`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN etiqueta_recibido_por VARCHAR(200) NULL`).catch(() => {});
db.query(`ALTER TABLE guia_templates ADD COLUMN etiqueta_obs_recibido VARCHAR(200) NULL`).catch(() => {});

// Migración: más tamaños en etiqueta_templates
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN size_barra_contacto TINYINT UNSIGNED NULL`).catch(() => {});
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN size_ruta_etiqueta TINYINT UNSIGNED NULL`).catch(() => {});
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN size_detalle_etiqueta TINYINT UNSIGNED NULL`).catch(() => {});
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN size_cab_fecha TINYINT UNSIGNED NULL`).catch(() => {});
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN size_cab_num TINYINT UNSIGNED NULL`).catch(() => {});

// Migración: dest_contacto, dest_telefono, dest_nombre, dest_direccion, dest_referencia en etiqueta_templates
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN mostrar_dest_contacto TINYINT(1) DEFAULT 1`).catch(() => {});
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN mostrar_dest_telefono TINYINT(1) DEFAULT 1`).catch(() => {});
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN obligatorio_dest_contacto TINYINT(1) DEFAULT 0`).catch(() => {});
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN obligatorio_dest_telefono TINYINT(1) DEFAULT 0`).catch(() => {});
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN mostrar_dest_nombre TINYINT(1) DEFAULT 1`).catch(() => {});
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN mostrar_dest_direccion TINYINT(1) DEFAULT 1`).catch(() => {});
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN mostrar_dest_referencia TINYINT(1) DEFAULT 1`).catch(() => {});
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN obligatorio_dest_nombre TINYINT(1) DEFAULT 0`).catch(() => {});
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN obligatorio_dest_direccion TINYINT(1) DEFAULT 0`).catch(() => {});
db.query(`ALTER TABLE etiqueta_templates ADD COLUMN obligatorio_dest_referencia TINYINT(1) DEFAULT 0`).catch(() => {});

// Migración: tabla etiqueta_templates
db.query(`
  CREATE TABLE IF NOT EXISTS etiqueta_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    mostrar_logo TINYINT(1) NOT NULL DEFAULT 1,
    mostrar_eslogan TINYINT(1) NOT NULL DEFAULT 1,
    mostrar_telefono TINYINT(1) NOT NULL DEFAULT 1,
    mostrar_telefono_adicional TINYINT(1) NOT NULL DEFAULT 0,
    mostrar_email TINYINT(1) NOT NULL DEFAULT 1,
    mostrar_sitio_web TINYINT(1) NOT NULL DEFAULT 1,
    mostrar_rfc TINYINT(1) NOT NULL DEFAULT 1,
    mostrar_direccion_fiscal TINYINT(1) NOT NULL DEFAULT 0,
    mostrar_barcode TINYINT(1) NOT NULL DEFAULT 1,
    mostrar_qr TINYINT(1) NOT NULL DEFAULT 1,
    mostrar_ruta TINYINT(1) NOT NULL DEFAULT 1,
    mostrar_descripcion TINYINT(1) NOT NULL DEFAULT 1,
    obligatorio_logo TINYINT(1) NOT NULL DEFAULT 0,
    obligatorio_eslogan TINYINT(1) NOT NULL DEFAULT 0,
    obligatorio_telefono TINYINT(1) NOT NULL DEFAULT 0,
    obligatorio_telefono_adicional TINYINT(1) NOT NULL DEFAULT 0,
    obligatorio_email TINYINT(1) NOT NULL DEFAULT 0,
    obligatorio_sitio_web TINYINT(1) NOT NULL DEFAULT 0,
    obligatorio_rfc TINYINT(1) NOT NULL DEFAULT 0,
    obligatorio_direccion_fiscal TINYINT(1) NOT NULL DEFAULT 0,
    obligatorio_barcode TINYINT(1) NOT NULL DEFAULT 0,
    obligatorio_qr TINYINT(1) NOT NULL DEFAULT 0,
    obligatorio_ruta TINYINT(1) NOT NULL DEFAULT 0,
    obligatorio_descripcion TINYINT(1) NOT NULL DEFAULT 0,
    creado_por INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).catch(() => {});

// Migración: columna template_etiqueta_id en clientes
db.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS template_etiqueta_id INT NULL`).catch(() => {});
// Migración: columna habilitado en clientes
db.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS habilitado TINYINT(1) NOT NULL DEFAULT 1`).catch(() => {});

// Migración: catálogo de tipos de empaque
db.query(`CREATE TABLE IF NOT EXISTS tipos_empaques (
  id INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,
  activo TINYINT(1) NULL DEFAULT 1,
  orden INT NULL DEFAULT 0,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_tipo_empaque_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`).catch(() => {});

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de vistas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configurar sesiones
app.use(session({
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // cambiar a true en producción con HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// Hacer disponible la sesión en todas las vistas
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// ── Bloqueo global para rol cliente ──────────────────────
// El cliente SOLO puede acceder a /portal-cliente y /auth
app.use((req, res, next) => {
  if (req.session && req.session.userRole === 'cliente') {
    const permitidas = ['/portal-cliente', '/auth'];
    const permitida  = permitidas.some(p => req.path.startsWith(p));
    if (!permitida) {
      return res.redirect('/portal-cliente');
    }
  }
  next();
});

// Rutas
const trackingRoutes = require('./routes/tracking');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const enviosRoutes = require('./routes/envios');
const clientesRoutes = require('./routes/clientes');
const reportesRoutes = require('./routes/reportes');
const configuracionRoutes = require('./routes/configuracion');
const enviosRetrasadosRoutes = require('./routes/envios-retrasados');
const usuariosRoutes = require('./routes/usuarios');
const perfilRoutes = require('./routes/perfil');
const direccionesRoutes = require('./routes/direcciones');
const historialRoutes      = require('./routes/historial');
const portalClienteRoutes  = require('./routes/portal-cliente');
const pictogramasRoutes    = require('./routes/pictogramas');


app.use('/tracking', trackingRoutes);
app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/envios', enviosRoutes);
app.use('/clientes', clientesRoutes);
app.use('/reportes', reportesRoutes);
app.use('/configuracion', configuracionRoutes);
app.use('/envios-retrasados', enviosRetrasadosRoutes);
app.use('/usuarios', usuariosRoutes);
app.use('/mi-perfil', perfilRoutes);
app.use('/direcciones', direccionesRoutes);
app.use('/historial', historialRoutes);
app.use('/portal-cliente', portalClienteRoutes);
app.use('/pictogramas', pictogramasRoutes);




// Iniciar servidor
app.listen(PORT, () => {
  console.log('=================================');
  console.log('🚀 Servidor corriendo');
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log('📦 Transportes AB - Sistema de Tracking');
  console.log('=================================');
  console.log('');
  console.log('🔗 Rutas disponibles:');
  console.log(`   • http://localhost:${PORT}/ - Página de tracking público`);
  console.log(`   • http://localhost:${PORT}/auth/login - Login`);
  console.log(`   • http://localhost:${PORT}/dashboard - Dashboard (requiere login)`);
  console.log('');
  console.log('🔐 Credenciales de prueba:');
  console.log('   Email: admin@tracking.com');
  console.log('   Password: admin123');
  console.log('=================================');
});