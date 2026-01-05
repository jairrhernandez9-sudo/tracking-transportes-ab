const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { redirectIfAuthenticated } = require('../middleware/auth');

// Página de login
router.get('/login', redirectIfAuthenticated, (req, res) => {
  res.render('login', {
    title: 'Iniciar Sesión',
    error: null
  });
});

// Procesar login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validar campos
    if (!email || !password) {
      return res.render('login', {
        title: 'Iniciar Sesión',
        error: 'Por favor completa todos los campos'
      });
    }
    
    // Buscar usuario
    const [users] = await db.query(
      'SELECT * FROM usuarios WHERE email = ? AND activo = true',
      [email]
    );
    
    if (users.length === 0) {
      return res.render('login', {
        title: 'Iniciar Sesión',
        error: 'Credenciales incorrectas'
      });
    }
    
    const user = users[0];
    
    // Verificar contraseña
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.render('login', {
        title: 'Iniciar Sesión',
        error: 'Credenciales incorrectas'
      });
    }
    
    // Crear sesión
    req.session.userId = user.id;
    req.session.userName = user.nombre;
    req.session.userEmail = user.email;
    req.session.userRole = user.rol;
    
    // Redirigir al dashboard
    res.redirect('/dashboard');
    
  } catch (error) {
    console.error('Error en login:', error);
    res.render('login', {
      title: 'Iniciar Sesión',
      error: 'Error al procesar el inicio de sesión'
    });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error al cerrar sesión:', err);
    }
    res.redirect('/auth/login');
  });
});

module.exports = router;