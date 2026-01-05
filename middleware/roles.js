// Middleware para verificar roles específicos
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    // Verificar si el usuario está autenticado
    if (!req.session.userId) {
      return res.redirect('/auth/login');
    }
    
    // Verificar si el rol del usuario está permitido
    const userRole = req.session.userRole;
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).render('error/403', {
        title: 'Acceso Denegado',
        mensaje: 'No tienes permisos para acceder a esta sección'
      });
    }
    
    next();
  };
};

// Middleware solo para admin
const requireAdmin = requireRole('admin');

// Middleware para admin u operador
const requireAdminOrOperator = requireRole('admin', 'operador');

module.exports = {
  requireRole,
  requireAdmin,
  requireAdminOrOperator
};