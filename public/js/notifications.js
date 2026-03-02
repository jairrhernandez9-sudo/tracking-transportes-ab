/**
 * Sistema de Notificaciones
 * Panel desplegable al hacer click en .notification-btn
 * Actualmente muestra: Envíos Retrasados
 * Extensible: agregar más secciones en la función render()
 */
(function () {
  'use strict';

  /* ── CSS ──────────────────────────────────────────────────────── */
  var CSS = [
    '#np-overlay{display:none;position:fixed;inset:0;z-index:9990;background:rgba(0,0,0,.3);}',
    '#np-overlay.np-open{display:block;}',

    '#np-panel{',
    '  display:none;position:fixed;top:72px;right:16px;',
    '  width:360px;max-height:calc(100vh - 90px);',
    '  background:#fff;border-radius:16px;',
    '  box-shadow:0 20px 60px rgba(0,0,0,.2);',
    '  z-index:9991;flex-direction:column;',
    '  animation:np-in .18s ease;',
    '}',
    '#np-panel.np-open{display:flex;}',

    '@keyframes np-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}',

    '.np-head{display:flex;align-items:center;justify-content:space-between;',
    '  padding:15px 18px;background:linear-gradient(135deg,#1e40af,#3b82f6);',
    '  color:#fff;flex-shrink:0;border-radius:16px 16px 0 0;}',

    '.np-head-title{display:flex;align-items:center;gap:8px;font-weight:700;font-size:.97rem;}',

    '.np-close-btn{background:rgba(255,255,255,.2);border:none;width:30px;height:30px;',
    '  border-radius:8px;cursor:pointer;color:#fff;font-size:1rem;',
    '  display:flex;align-items:center;justify-content:center;}',
    '.np-close-btn:hover{background:rgba(255,255,255,.35);}',

    '.np-body{overflow-y:auto;flex:1;padding:12px;}',

    '.np-section-lbl{display:flex;align-items:center;justify-content:space-between;',
    '  padding:4px 4px 8px;font-size:.73rem;font-weight:700;text-transform:uppercase;',
    '  letter-spacing:.5px;color:#6b7280;border-bottom:1px solid #f3f4f6;margin-bottom:10px;}',

    '.np-cnt{background:#ef4444;color:#fff;font-size:.68rem;font-weight:800;',
    '  padding:2px 7px;border-radius:20px;}',

    '.np-item{display:flex;align-items:center;gap:10px;padding:10px 11px;',
    '  border:1.5px solid #f1f5f9;border-radius:10px;margin-bottom:7px;',
    '  text-decoration:none;color:inherit;transition:all .15s;}',
    '.np-item:hover{border-color:#3b82f6;background:#eff6ff;}',

    '.np-item-ico{width:34px;height:34px;border-radius:9px;display:flex;',
    '  align-items:center;justify-content:center;font-size:.95rem;flex-shrink:0;}',

    '.np-item-info{flex:1;min-width:0;}',
    '.np-item-trk{font-size:.84rem;font-weight:700;color:#1e293b;',
    '  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.np-item-emp{font-size:.77rem;color:#64748b;margin-top:2px;',
    '  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',

    '.np-sev{flex-shrink:0;font-size:.69rem;font-weight:700;padding:3px 8px;',
    '  border-radius:20px;color:#fff;}',

    '.np-more{text-align:center;font-size:.79rem;color:#94a3b8;padding:2px 0 8px;}',

    '.np-foot{border-top:1px solid #f1f5f9;padding:12px;flex-shrink:0;}',
    '.np-foot-btn{display:block;text-align:center;',
    '  background:linear-gradient(135deg,#1e40af,#3b82f6);',
    '  color:#fff;border-radius:10px;padding:10px;font-size:.84rem;',
    '  font-weight:600;text-decoration:none;transition:opacity .15s;}',
    '.np-foot-btn:hover{opacity:.88;}',

    '.np-empty{text-align:center;padding:28px 0;color:#94a3b8;}',
    '.np-empty-ico{font-size:2.4rem;margin-bottom:6px;}',
    '.np-empty-msg{font-size:.88rem;}',
    '.np-loading{text-align:center;padding:28px 0;color:#94a3b8;font-size:.88rem;}',
    '.np-error{text-align:center;padding:18px 0;color:#ef4444;font-size:.84rem;}'
  ].join('');

  /* ── HTML ─────────────────────────────────────────────────────── */
  var PANEL_HTML = '<div id="np-overlay"></div>' +
    '<div id="np-panel" role="dialog" aria-label="Notificaciones">' +
      '<div class="np-head">' +
        '<div class="np-head-title">' +
          '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' +
          ' Notificaciones' +
        '</div>' +
        '<button class="np-close-btn" onclick="npClose()" title="Cerrar">&#x2715;</button>' +
      '</div>' +
      '<div class="np-body" id="np-body"><div class="np-loading">Cargando&#8230;</div></div>' +
      '<div class="np-foot" id="np-foot" style="display:none;">' +
        '<a href="/envios-retrasados" class="np-foot-btn">Ver todos los envíos retrasados &#8594;</a>' +
      '</div>' +
    '</div>';

  /* ── Estado ───────────────────────────────────────────────────── */
  var open    = false;
  var lastTs  = 0;
  var cache   = null;

  /* ── API pública ──────────────────────────────────────────────── */
  window.npClose = function () {
    if (!open) return;
    open = false;
    document.getElementById('np-overlay').classList.remove('np-open');
    document.getElementById('np-panel').classList.remove('np-open');
  };

  /* ── Internos ─────────────────────────────────────────────────── */
  function npToggle() {
    if (open) { window.npClose(); return; }
    open = true;
    document.getElementById('np-overlay').classList.add('np-open');
    document.getElementById('np-panel').classList.add('np-open');
    if (!cache || Date.now() - lastTs > 60000) {
      fetchData();
    } else {
      render(cache);
    }
  }

  function fetchData() {
    document.getElementById('np-body').innerHTML = '<div class="np-loading">Cargando&#8230;</div>';
    document.getElementById('np-foot').style.display = 'none';
    fetch('/envios-retrasados/api', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (data) { lastTs = Date.now(); cache = data; render(data); })
      .catch(function () {
        document.getElementById('np-body').innerHTML =
          '<div class="np-error">No se pudieron cargar las notificaciones.</div>';
      });
  }

  function sevInfo(dias) {
    if (dias > 7) return { bg: '#ef4444', txt: dias + ' días' };
    if (dias > 3) return { bg: '#f59e0b', txt: dias + ' días' };
    return                { bg: '#f97316', txt: dias + ' días' };
  }

  function esc(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function render(data) {
    var body = document.getElementById('np-body');
    var foot = document.getElementById('np-foot');

    if (!data.ok) {
      body.innerHTML = '<div class="np-error">Error al cargar las notificaciones.</div>';
      foot.style.display = 'none';
      return;
    }

    if (!data.total) {
      body.innerHTML =
        '<div class="np-empty">' +
          '<div class="np-empty-ico">&#x1F389;</div>' +
          '<div class="np-empty-msg">&#xA1;Sin env&#xED;os retrasados!</div>' +
        '</div>';
      foot.style.display = 'none';
      return;
    }

    var html =
      '<div class="np-section-lbl">' +
        '<span>&#9888; Env&#xED;os Retrasados</span>' +
        '<span class="np-cnt">' + data.total + '</span>' +
      '</div>';

    data.items.forEach(function (item) {
      var s = sevInfo(item.dias_retraso);
      html +=
        '<a href="/envios/' + item.id + '" class="np-item" onclick="npClose()">' +
          '<div class="np-item-ico" style="background:' + s.bg + '22;">' +
            '<span style="color:' + s.bg + ';">&#9888;</span>' +
          '</div>' +
          '<div class="np-item-info">' +
            '<div class="np-item-trk">' + esc(item.numero_tracking) + '</div>' +
            '<div class="np-item-emp">' + esc(item.nombre_empresa)  + '</div>' +
          '</div>' +
          '<span class="np-sev" style="background:' + s.bg + ';">' + s.txt + '</span>' +
        '</a>';
    });

    if (data.total > data.items.length) {
      html += '<div class="np-more">Y ' + (data.total - data.items.length) + ' m&#xE1;s&#8230;</div>';
    }

    body.innerHTML = html;
    foot.style.display = '';
  }

  /* ── Actualizar badge en todas las páginas ────────────────────── */
  function updateBadge() {
    fetch('/envios-retrasados/api', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok) return;
        // Guardar en cache para que el panel no tenga que volver a fetchar
        lastTs  = Date.now();
        cache   = data;
        // Actualizar todos los badges en la página
        document.querySelectorAll('.notification-badge').forEach(function (el) {
          if (data.total > 0) {
            el.textContent = data.total > 99 ? '99+' : String(data.total);
            el.style.display = '';
          } else {
            el.style.display = 'none';
          }
        });
      })
      .catch(function () { /* silencioso — no bloquear la UI */ });
  }

  /* ── Init ─────────────────────────────────────────────────────── */
  function init() {
    // Inyectar CSS
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    // Inyectar panel
    var tmp = document.createElement('div');
    tmp.innerHTML = PANEL_HTML;
    while (tmp.firstChild) { document.body.appendChild(tmp.firstChild); }

    // Interceptar clicks en el botón de notificaciones
    document.querySelectorAll('.notification-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        npToggle();
      });
    });

    // Cerrar al hacer click en el overlay
    document.getElementById('np-overlay').addEventListener('click', window.npClose);

    // Cerrar con ESC
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') window.npClose();
    });

    // Actualizar badge silenciosamente al cargar la página
    updateBadge();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
