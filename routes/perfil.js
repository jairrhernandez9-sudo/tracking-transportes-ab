const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcrypt');
const { isAuthenticated } = require('../middleware/auth');

// Mostrar página de perfil
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const [usuario] = await db.query(
      'SELECT id, nombre, email, rol FROM usuarios WHERE id = ?',
      [req.session.userId]
    );
    
    if (usuario.length === 0) {
      return res.redirect('/auth/logout');
    }
    
    res.render('perfil/index', {
      title: 'Mi Perfil',
      user: {
        id: usuario[0].id,
        nombre: usuario[0].nombre,
        email: usuario[0].email,
        rol: usuario[0].rol
      },
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    console.error('Error al cargar perfil:', error);
    res.status(500).send('Error al cargar el perfil');
  }
});

// Actualizar datos personales
router.post('/actualizar-datos', isAuthenticated, async (req, res) => {
  try {
    const { nombre, email } = req.body;
    
    // Validar
    if (!nombre || !email) {
      return res.redirect('/mi-perfil?error=campos_vacios');
    }
    
    // Verificar si el email ya existe (excepto el propio)
    const [existente] = await db.query(
      'SELECT id FROM usuarios WHERE email = ? AND id != ?',
      [email, req.session.userId]
    );
    
    if (existente.length > 0) {
      return res.redirect('/mi-perfil?error=email_existe');
    }
    
    // Actualizar
    await db.query(
      'UPDATE usuarios SET nombre = ?, email = ? WHERE id = ?',
      [nombre, email, req.session.userId]
    );
    
    // Actualizar sesión
    req.session.userName = nombre;
    req.session.userEmail = email;
    
    res.redirect('/mi-perfil?success=datos_actualizados');
  } catch (error) {
    console.error('Error al actualizar datos:', error);
    res.redirect('/mi-perfil?error=error_servidor');
  }
});

// Cambiar contraseña
router.post('/cambiar-password', isAuthenticated, async (req, res) => {
  try {
    const { password_actual, password_nueva, password_confirmar } = req.body;
    
    // Validar
    if (!password_actual || !password_nueva || !password_confirmar) {
      return res.redirect('/mi-perfil?error=campos_vacios');
    }
    
    if (password_nueva !== password_confirmar) {
      return res.redirect('/mi-perfil?error=passwords_no_coinciden');
    }
    
    if (password_nueva.length < 6) {
      return res.redirect('/mi-perfil?error=password_corta');
    }
    
    // Verificar contraseña actual
    const [usuario] = await db.query(
      'SELECT password FROM usuarios WHERE id = ?',
      [req.session.userId]
    );
    
    const passwordValida = await bcrypt.compare(password_actual, usuario[0].password);
    
    if (!passwordValida) {
      return res.redirect('/mi-perfil?error=password_incorrecta');
    }
    
    // Hashear nueva contraseña
    const hashedPassword = await bcrypt.hash(password_nueva, 10);
    
    // Actualizar
    await db.query(
      'UPDATE usuarios SET password = ? WHERE id = ?',
      [hashedPassword, req.session.userId]
    );
    
    res.redirect('/mi-perfil?success=password_actualizada');
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.redirect('/mi-perfil?error=error_servidor');
  }
});

module.exports = router;