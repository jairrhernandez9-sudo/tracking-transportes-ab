const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcrypt');
const { isAuthenticated } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roles');

// ============================================
// LISTA DE USUARIOS (Solo Admin)
// ============================================
router.get('/', isAuthenticated, requireAdmin, async (req, res) => {
  try {
    const { buscar, rol } = req.query;
    
    let query = `
      SELECT 
        id,
        nombre,
        email,
        rol,
        fecha_creacion
      FROM usuarios
      WHERE 1=1
    `;
    
    const params = [];
    
    if (buscar) {
      query += ` AND (nombre LIKE ? OR email LIKE ?)`;
      params.push(`%${buscar}%`, `%${buscar}%`);
    }
    
    if (rol) {
      query += ` AND rol = ?`;
      params.push(rol);
    }
    
    query += ` ORDER BY fecha_creacion DESC`;
    
    const [usuarios] = await db.query(query, params);
    
    // Estadísticas
    const [statsTotal] = await db.query('SELECT COUNT(*) as total FROM usuarios');
    const [statsAdmin] = await db.query('SELECT COUNT(*) as total FROM usuarios WHERE rol = "admin"');
    const [statsOperador] = await db.query('SELECT COUNT(*) as total FROM usuarios WHERE rol = "operador"');
    
res.render('usuarios/lista', {
  title: 'Gestión de Usuarios',
  user: {
    nombre: req.session.userName,
    email: req.session.userEmail,
    rol: req.session.userRole
  },
  usuarios,
  stats: {
    total: statsTotal[0].total,
    admin: statsAdmin[0].total,
    operador: statsOperador[0].total
  },
  filtros: {
    buscar: buscar || '',
    rol: rol || ''
  },
  success: req.query.success || null,
  error: req.query.error || null
});
    
  } catch (error) {
    console.error('Error al cargar usuarios:', error);
    res.status(500).send('Error al cargar usuarios');
  }
});

// ============================================
// FORMULARIO NUEVO USUARIO
// ============================================
router.get('/nuevo', isAuthenticated, requireAdmin, (req, res) => {
  res.render('usuarios/nuevo', {
    title: 'Nuevo Usuario',
    user: {
      nombre: req.session.userName,
      email: req.session.userEmail,
      rol: req.session.userRole
    },
    error: null
  });
});

// ============================================
// CREAR USUARIO
// ============================================
router.post('/nuevo', isAuthenticated, requireAdmin, async (req, res) => {
  try {
    const { nombre, email, password, password_confirmar, rol } = req.body;
    
    // Validaciones
    if (!nombre || !email || !password || !password_confirmar || !rol) {
      return res.render('usuarios/nuevo', {
        title: 'Nuevo Usuario',
        user: {
          nombre: req.session.userName,
          email: req.session.userEmail,
          rol: req.session.userRole
        },
        error: 'Todos los campos son obligatorios'
      });
    }
    
    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.render('usuarios/nuevo', {
        title: 'Nuevo Usuario',
        user: {
          nombre: req.session.userName,
          email: req.session.userEmail,
          rol: req.session.userRole
        },
        error: 'Email inválido'
      });
    }
    
    // Validar contraseñas
    if (password !== password_confirmar) {
      return res.render('usuarios/nuevo', {
        title: 'Nuevo Usuario',
        user: {
          nombre: req.session.userName,
          email: req.session.userEmail,
          rol: req.session.userRole
        },
        error: 'Las contraseñas no coinciden'
      });
    }
    
    if (password.length < 6) {
      return res.render('usuarios/nuevo', {
        title: 'Nuevo Usuario',
        user: {
          nombre: req.session.userName,
          email: req.session.userEmail,
          rol: req.session.userRole
        },
        error: 'La contraseña debe tener al menos 6 caracteres'
      });
    }
    
    // Validar rol
    if (!['admin', 'operador'].includes(rol)) {
      return res.render('usuarios/nuevo', {
        title: 'Nuevo Usuario',
        user: {
          nombre: req.session.userName,
          email: req.session.userEmail,
          rol: req.session.userRole
        },
        error: 'Rol inválido'
      });
    }
    
    // Verificar si el email ya existe
    const [existente] = await db.query(
      'SELECT id FROM usuarios WHERE email = ?',
      [email]
    );
    
    if (existente.length > 0) {
      return res.render('usuarios/nuevo', {
        title: 'Nuevo Usuario',
        user: {
          nombre: req.session.userName,
          email: req.session.userEmail,
          rol: req.session.userRole
        },
        error: 'Ya existe un usuario con ese email'
      });
    }
    
    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Crear usuario
    await db.query(
      'INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)',
      [nombre, email, hashedPassword, rol]
    );
    
    res.redirect('/usuarios?success=created');
    
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.render('usuarios/nuevo', {
      title: 'Nuevo Usuario',
      user: {
        nombre: req.session.userName,
        email: req.session.userEmail,
        rol: req.session.userRole
      },
      error: 'Error al crear el usuario'
    });
  }
});

// ============================================
// FORMULARIO EDITAR USUARIO
// ============================================
router.get('/:id/editar', isAuthenticated, requireAdmin, async (req, res) => {
  try {
    const [usuarios] = await db.query(
      'SELECT id, nombre, email, rol, fecha_creacion FROM usuarios WHERE id = ?',
      [req.params.id]
    );
    
    if (usuarios.length === 0) {
      return res.redirect('/usuarios?error=notfound');
    }
    
    res.render('usuarios/editar', {
      title: 'Editar Usuario',
      user: {
        nombre: req.session.userName,
        email: req.session.userEmail,
        rol: req.session.userRole
      },
      usuario: usuarios[0],
      error: null,
      success: null
    });
    
  } catch (error) {
    console.error('Error al cargar usuario:', error);
    res.redirect('/usuarios?error=load');
  }
});

// ============================================
// ACTUALIZAR USUARIO
// ============================================
router.post('/:id/editar', isAuthenticated, requireAdmin, async (req, res) => {
  try {
    const { nombre, email, rol, password_nueva, password_confirmar } = req.body;
    const userId = req.params.id;
    
    // Obtener usuario actual
    const [usuarios] = await db.query(
      'SELECT * FROM usuarios WHERE id = ?',
      [userId]
    );
    
    if (usuarios.length === 0) {
      return res.redirect('/usuarios?error=notfound');
    }
    
    const usuario = usuarios[0];
    
    // Validaciones
    if (!nombre || !email || !rol) {
      return res.render('usuarios/editar', {
        title: 'Editar Usuario',
        user: {
          nombre: req.session.userName,
          email: req.session.userEmail,
          rol: req.session.userRole
        },
        usuario: { ...usuario, nombre, email, rol },
        error: 'Nombre, email y rol son obligatorios',
        success: null
      });
    }
    
    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.render('usuarios/editar', {
        title: 'Editar Usuario',
        user: {
          nombre: req.session.userName,
          email: req.session.userEmail,
          rol: req.session.userRole
        },
        usuario: { ...usuario, nombre, email, rol },
        error: 'Email inválido',
        success: null
      });
    }
    
    // Verificar si el email ya existe (excluyendo el usuario actual)
    const [existente] = await db.query(
      'SELECT id FROM usuarios WHERE email = ? AND id != ?',
      [email, userId]
    );
    
    if (existente.length > 0) {
      return res.render('usuarios/editar', {
        title: 'Editar Usuario',
        user: {
          nombre: req.session.userName,
          email: req.session.userEmail,
          rol: req.session.userRole
        },
        usuario: { ...usuario, nombre, email, rol },
        error: 'Ya existe otro usuario con ese email',
        success: null
      });
    }
    
    // Si se proporciona nueva contraseña
    let updateQuery = 'UPDATE usuarios SET nombre = ?, email = ?, rol = ? WHERE id = ?';
    let updateParams = [nombre, email, rol, userId];
    
    if (password_nueva) {
      // Validar contraseñas
      if (password_nueva !== password_confirmar) {
        return res.render('usuarios/editar', {
          title: 'Editar Usuario',
          user: {
            nombre: req.session.userName,
            email: req.session.userEmail,
            rol: req.session.userRole
          },
          usuario: { ...usuario, nombre, email, rol },
          error: 'Las contraseñas no coinciden',
          success: null
        });
      }
      
      if (password_nueva.length < 6) {
        return res.render('usuarios/editar', {
          title: 'Editar Usuario',
          user: {
            nombre: req.session.userName,
            email: req.session.userEmail,
            rol: req.session.userRole
          },
          usuario: { ...usuario, nombre, email, rol },
          error: 'La contraseña debe tener al menos 6 caracteres',
          success: null
        });
      }
      
      // Hash de la nueva contraseña
      const hashedPassword = await bcrypt.hash(password_nueva, 10);
      updateQuery = 'UPDATE usuarios SET nombre = ?, email = ?, rol = ?, password = ? WHERE id = ?';
      updateParams = [nombre, email, rol, hashedPassword, userId];
    }
    
    // Actualizar usuario
    await db.query(updateQuery, updateParams);
    
    // Si el usuario editó su propio perfil, actualizar sesión
    if (userId == req.session.userId) {
      req.session.userName = nombre;
      req.session.userEmail = email;
      req.session.userRole = rol;
    }
    
    res.redirect('/usuarios?success=updated');
    
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.redirect('/usuarios?error=update');
  }
});

// ============================================
// ELIMINAR USUARIO
// ============================================
router.post('/:id/eliminar', isAuthenticated, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    
    // No permitir que el admin se elimine a sí mismo
    if (userId == req.session.userId) {
      return res.redirect('/usuarios?error=selfdelete');
    }
    
    // Verificar si el usuario existe
    const [usuarios] = await db.query(
      'SELECT id FROM usuarios WHERE id = ?',
      [userId]
    );
    
    if (usuarios.length === 0) {
      return res.redirect('/usuarios?error=notfound');
    }
    
    // Eliminar usuario
    await db.query('DELETE FROM usuarios WHERE id = ?', [userId]);
    
    res.redirect('/usuarios?success=deleted');
    
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.redirect('/usuarios?error=delete');
  }
});

module.exports = router;