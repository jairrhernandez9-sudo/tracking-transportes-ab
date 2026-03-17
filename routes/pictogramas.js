const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const db      = require('../config/database');
const { isAuthenticated, hasRole } = require('../middleware/auth');

const isAdminOrSuper = hasRole('admin', 'superusuario');

// ── Multer config ─────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/uploads/pictogramas'));
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = 'picto_' + Date.now() + ext;
    cb(null, name);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Solo se permiten imágenes (PNG, JPG, GIF, SVG, WEBP)'));
  }
});

// ── GET /pictogramas/lista (JSON — para selectores) ───────────
router.get('/lista', isAuthenticated, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, nombre, imagen_url FROM pictogramas WHERE activo = 1 ORDER BY orden ASC, nombre ASC'
    );
    res.json({ ok: true, pictogramas: rows });
  } catch (e) {
    res.json({ ok: false, pictogramas: [] });
  }
});

// ── POST /pictogramas/subir ───────────────────────────────────
router.post('/subir', isAuthenticated, isAdminOrSuper, upload.single('imagen'), async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre || !req.file) {
      return res.redirect('/configuracion?tab=pictogramas&error=campos_requeridos');
    }
    const imagen_url = '/uploads/pictogramas/' + req.file.filename;
    await db.query(
      'INSERT INTO pictogramas (nombre, imagen_url, creado_por) VALUES (?, ?, ?)',
      [nombre.trim(), imagen_url, req.session.userId]
    );
    res.redirect('/configuracion?tab=pictogramas&success=subido');
  } catch (e) {
    console.error(e);
    res.redirect('/configuracion?tab=pictogramas&error=error_servidor');
  }
});

// ── POST /pictogramas/:id/eliminar ────────────────────────────
router.post('/:id/eliminar', isAuthenticated, isAdminOrSuper, async (req, res) => {
  try {
    const { id } = req.params;
    const [[row]] = await db.query('SELECT imagen_url FROM pictogramas WHERE id = ?', [id]);
    if (row) {
      const filePath = path.join(__dirname, '../public', row.imagen_url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      await db.query('DELETE FROM pictogramas WHERE id = ?', [id]);
    }
    res.redirect('/configuracion?tab=pictogramas&success=eliminado');
  } catch (e) {
    console.error(e);
    res.redirect('/configuracion?tab=pictogramas&error=error_servidor');
  }
});

// ── POST /pictogramas/:id/toggle-activo ───────────────────────
router.post('/:id/toggle-activo', isAuthenticated, isAdminOrSuper, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('UPDATE pictogramas SET activo = NOT activo WHERE id = ?', [id]);
    res.redirect('/configuracion?tab=pictogramas');
  } catch (e) {
    res.redirect('/configuracion?tab=pictogramas&error=error_servidor');
  }
});

// ── POST /pictogramas/:id/orden ───────────────────────────────
router.post('/:id/orden', isAuthenticated, isAdminOrSuper, async (req, res) => {
  try {
    const { id } = req.params;
    const { orden } = req.body;
    await db.query('UPDATE pictogramas SET orden = ? WHERE id = ?', [parseInt(orden) || 0, id]);
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false });
  }
});

module.exports = router;
