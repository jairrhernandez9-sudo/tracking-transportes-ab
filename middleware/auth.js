// Middleware para proteger rutas que requieren autenticación
function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.redirect('/auth/login');
}

// Middleware para verificar roles específicos
function hasRole(...roles) {
  return (req, res, next) => {
    if (req.session && req.session.userId && roles.includes(req.session.userRole)) {
      return next();
    }
    res.status(403).send('Acceso denegado');
  };
}

// Middleware específico para admin (más simple)
function isAdmin(req, res, next) {
  if (req.session && req.session.userId && req.session.userRole === 'admin') {
    return next();
  }
  res.status(403).send('Acceso denegado. Solo administradores.');
}

// Middleware para redirigir si ya está autenticado
function redirectIfAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  next();
}

module.exports = {
  isAuthenticated,
  hasRole,
  isAdmin,
  redirectIfAuthenticated
};