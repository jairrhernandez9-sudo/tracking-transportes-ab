// Middleware para verificar roles específicos
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.session.userId) {
      return res.redirect('/auth/login');
    }
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

const requireAdmin          = requireRole('admin');
const requireSuperusuario   = requireRole('superusuario');
const requireAdminOrSuper   = requireRole('admin', 'superusuario');
const requireAdminOrOperator= requireRole('admin', 'superusuario', 'operador');
const requireCliente        = requireRole('cliente');

module.exports = {
  requireRole,
  requireAdmin,
  requireSuperusuario,
  requireAdminOrSuper,
  requireAdminOrOperator,
  requireCliente
};