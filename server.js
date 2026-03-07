const express = require('express');
const path = require('path');
const session = require('express-session');
require('dotenv').config();
const db = require('./config/database');

// Migraciones de columnas
db.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS pagina_inicio VARCHAR(50) NOT NULL DEFAULT 'dashboard'`).catch(() => {});
db.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_cliente_id INT NULL`).catch(() => {});

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
const historialRoutes    = require('./routes/historial');
const portalClienteRoutes = require('./routes/portal-cliente');


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