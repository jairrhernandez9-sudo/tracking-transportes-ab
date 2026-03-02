/**
 * sidebar.js — Toggle del menú lateral (sidebar)
 * Inyecta automáticamente el botón hamburger y el overlay.
 * Compatible con todas las páginas del sistema.
 */
(function () {
  'use strict';

  var BREAKPOINT = 768;

  function isMobile() {
    return window.innerWidth <= BREAKPOINT;
  }

  /* ── Crear e inyectar overlay ──────────────────────────────── */
  function createOverlay() {
    var overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.id = 'sidebar-overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', closeSidebar);
    return overlay;
  }

  /* ── Crear botón hamburger ─────────────────────────────────── */
  function createToggleButton() {
    var btn = document.createElement('button');
    btn.className = 'menu-toggle';
    btn.id = 'menuToggle';
    btn.setAttribute('aria-label', 'Abrir/cerrar menú');
    btn.setAttribute('type', 'button');
    btn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"' +
      ' stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<line x1="3" y1="6" x2="21" y2="6"/>' +
      '<line x1="3" y1="12" x2="21" y2="12"/>' +
      '<line x1="3" y1="18" x2="21" y2="18"/>' +
      '</svg>';
    btn.addEventListener('click', toggleSidebar);
    return btn;
  }

  /* ── Open / Close ──────────────────────────────────────────── */
  function openSidebar() {
    var sidebar = document.querySelector('.sidebar');
    var overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    var sidebar = document.querySelector('.sidebar');
    var overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  function toggleSidebar() {
    var sidebar = document.querySelector('.sidebar');
    if (sidebar && sidebar.classList.contains('open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  /* ── Init ──────────────────────────────────────────────────── */
  function init() {
    var sidebar = document.querySelector('.sidebar');
    if (!sidebar) return; // página sin sidebar, no hacer nada

    // Inyectar overlay
    createOverlay();

    // Inyectar botón hamburger al inicio del .header o .page-header
    var header = document.querySelector('.header, .page-header');
    if (header) {
      var btn = createToggleButton();
      header.insertBefore(btn, header.firstChild);
    }

    // Cerrar sidebar al hacer click en un enlace de nav (en mobile)
    var navLinks = document.querySelectorAll('.nav-link, .nav-link-logout');
    navLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        if (isMobile()) closeSidebar();
      });
    });

    // Cerrar con ESC
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSidebar();
    });

    // Cerrar si se redimensiona a desktop
    window.addEventListener('resize', function () {
      if (!isMobile()) closeSidebar();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
