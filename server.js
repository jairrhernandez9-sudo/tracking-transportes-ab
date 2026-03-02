const express = require('express');
const path = require('path');
const session = require('express-session');
require('dotenv').config();

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