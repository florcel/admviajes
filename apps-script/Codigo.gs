/**
 * VIAJES Y SALIDAS — Etapa 1
 * Aplicación web: salidas, presupuesto, control interno, PDF para las familias y confirmación del nivel.
 *
 * Roles (hoja USUARIOS):
 *   admin → ve y edita todo.
 *   nivel → ve las salidas de su nivel, pide salidas nuevas y confirma o pide cambios en los presupuestos.
 */

var ESTADOS = {
  SOLICITADA: 'Pedida por el nivel',
  BORRADOR: 'En preparación',
  ENVIADA: 'Enviada al nivel',
  CONFIRMADA: 'Confirmada',
  CAMBIOS: 'Cambios pedidos',
  SUSPENDIDA: 'Suspendida'
};
var EDITABLES_ADMIN = ['nombre', 'destino', 'nivel', 'curso', 'fecha_salida', 'fecha_regreso', 'pernocte', 'total_alumnos',
  'docentes', 'transporte', 'responsable', 'pct_estimados', 'alumnos_calculo', 'cuotas', 'mes_inicio_cobro', 'notas_internas'];
var EDITABLES_NIVEL = ['nombre', 'destino', 'curso', 'fecha_salida', 'fecha_regreso', 'pernocte', 'total_alumnos', 'docentes', 'comentario_nivel'];
var BLOQUEADOS = ['ENVIADA', 'CONFIRMADA', 'SUSPENDIDA'];

/* ---------- Entrada ---------- */

function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate()
    .setTitle('Viajes y Salidas')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function include(nombre) {
  return HtmlService.createHtmlOutputFromFile(nombre).getContent();
}

/** Cálculos compartidos con el navegador (archivo calc.html). */
var CALC_ = null;
function calc_() {
  if (!CALC_) {
    var src = HtmlService.createHtmlOutputFromFile('calc').getContent().replace(/<\/?script>/g, '');
    CALC_ = new Function(src + '\nreturn Calc;')();
  }
  return CALC_;
}

/* ---------- Usuario y permisos ---------- */

function usuario_() {
  var email = String(Session.getActiveUser().getEmail() || '').toLowerCase().trim();
  if (!email) throw new Error('No se pudo identificar tu cuenta. Entrá con tu cuenta del colegio.');
  var u = leerTabla_('USUARIOS').filter(function (r) {
    return String(r.email).toLowerCase().trim() === email && String(r.activo).toUpperCase() !== 'NO';
  })[0];
  if (!u) throw new Error('Tu cuenta (' + email + ') todavía no tiene acceso. Pedile a administración que te agregue en la hoja USUARIOS.');
  var rol = String(u.rol).toLowerCase().trim();
  if (rol !== 'admin' && rol !== 'nivel') throw new Error('Tu usuario tiene un rol desconocido: «' + u.rol + '».');
  return { email: email, nombre: u.nombre || email, rol: rol, nivel: String(u.nivel || '').trim() };
}

function esAdmin_(u) { return u.rol === 'admin'; }

function puedeVer_(u, s) {
  if (esAdmin_(u)) return true;
  if (u.nivel === 'Todos') return true;
  return s.nivel === u.nivel || s.nivel === 'Varios niveles' || String(s.responsable).toLowerCase() === u.email;
}

function exigirAdmin_(u) {
  if (!esAdmin_(u)) throw new Error('Esta acción es solo para administración.');
}

function buscarSalida_(id) {
  var s = leerTabla_('SALIDAS').filter(function (r) { return String(r.id) === String(id); })[0];
  if (!s) throw new Error('No existe la salida ' + id + '.');
  return s;
}

function itemsDe_(id) {
  return leerTabla_('ITEMS')
    .filter(function (r) { return String(r.id_salida) === String(id); })
    .sort(function (a, b) { return (Number(a.orden) || 0) - (Number(b.orden) || 0); });
}

/* ---------- API para el navegador ---------- */

function iniciar() {
  var u = usuario_();
  var cfg = leerConfig_();
  return {
    usuario: u,
    config: {
      nombre_colegio: cfg.nombre_colegio, anio: cfg.anio, pct_estimados: cfg.pct_estimados,
      redondeo: cfg.redondeo, prefijo_id: cfg.prefijo_id
    },
    honorarios: esAdmin_(u) ? leerTabla_('HONORARIOS') : [],
    estados: ESTADOS,
    niveles: LISTAS.nivel,
    logo: logoDataUri_(cfg)
  };
}

function listarSalidas() {
  var u = usuario_();
  var cfg = leerConfig_();
  var C = calc_();
  var porSalida = {};
  leerTabla_('ITEMS').forEach(function (it) {
    (porSalida[it.id_salida] = porSalida[it.id_salida] || []).push(it);
  });
  return leerTabla_('SALIDAS')
    .filter(function (s) { return puedeVer_(u, s); })
    .map(function (s) {
      var pr = C.presupuesto(s, porSalida[s.id] || [], cfg);
      var mostrarValor = esAdmin_(u) || ['ENVIADA', 'CONFIRMADA', 'CAMBIOS'].indexOf(s.estado) > -1;
      return {
        id: s.id, nombre: s.nombre, destino: s.destino, nivel: s.nivel, curso: s.curso,
        fecha_salida: s.fecha_salida, fecha_regreso: s.fecha_regreso, total_alumnos: s.total_alumnos,
        estado: s.estado, valor: mostrarValor ? pr.valor : null, cuotas: pr.cuotas, cuota: mostrarValor ? pr.cuota : null
      };
    })
    .sort(function (a, b) { return String(a.fecha_salida || '9999').localeCompare(String(b.fecha_salida || '9999')); });
}

function obtenerSalida(id) {
  var u = usuario_();
  var s = buscarSalida_(id);
  if (!puedeVer_(u, s)) throw new Error('No tenés acceso a esta salida.');
  delete s._fila;
  var items = itemsDe_(id).map(function (it) { delete it._fila; return it; });
  if (esAdmin_(u)) {
    s.historial = leerTabla_('LOG').filter(function (l) { return String(l.id_salida) === String(id); })
      .map(function (l) { return { fecha: l.fecha, usuario: l.usuario, accion: l.accion, detalle: l.detalle }; })
      .reverse().slice(0, 30);
    return { salida: s, items: items };
  }
  // El nivel ve el presupuesto como lo ven las familias: sin precios, sin meses de pago, sin notas internas.
  var cfg = leerConfig_();
  var pr = calc_().presupuesto(s, items, cfg);
  delete s.notas_internas; delete s.pct_estimados; delete s.alumnos_calculo;
  var visible = ['ENVIADA', 'CONFIRMADA', 'CAMBIOS'].indexOf(s.estado) > -1;
  return {
    salida: s,
    resumen: visible ? {
      valor: pr.valor, cuotas: pr.cuotas, cuota: pr.cuota, mesInicio: pr.mesInicio, mesFin: pr.mesFin,
      incluye: items.filter(function (it) { return String(it.mostrar_pdf).toUpperCase() !== 'NO'; }).map(function (it) { return it.concepto; })
    } : null
  };
}

/** Crea o actualiza los datos de una salida. Devuelve el id. */
function guardarSalida(datos) {
  var u = usuario_();
  return conBloqueo_(function () {
    var ahora = new Date();
    if (!datos.id) {
      var nueva = { creado_por: u.email, creado_fecha: ahora, actualizado_fecha: ahora };
      var campos = esAdmin_(u) ? EDITABLES_ADMIN : EDITABLES_NIVEL;
      campos.forEach(function (c) { if (datos[c] !== undefined) nueva[c] = limpiar_(c, datos[c]); });
      if (!esAdmin_(u)) {
        if (!u.nivel || u.nivel === 'Todos') throw new Error('Tu usuario no tiene un nivel asignado.');
        nueva.nivel = u.nivel;
        nueva.responsable = u.email;
      }
      if (!nueva.nombre) throw new Error('Poné un nombre para la salida.');
      nueva.id = nuevoId_();
      nueva.estado = esAdmin_(u) ? 'BORRADOR' : 'SOLICITADA';
      if (esAdmin_(u) && !nueva.cuotas) nueva.cuotas = 1;
      agregarFila_('SALIDAS', nueva);
      registrar_(u.email, nueva.id, 'Creó la salida', nueva.nombre);
      if (!esAdmin_(u)) avisarAdministracion_(nueva, 'Nueva salida pedida por ' + u.nombre, 'El nivel ' + u.nivel + ' pidió una salida nueva.');
      return nueva.id;
    }
    var s = buscarSalida_(datos.id);
    if (!puedeVer_(u, s)) throw new Error('No tenés acceso a esta salida.');
    var cambios = { actualizado_fecha: ahora };
    if (esAdmin_(u)) {
      if (BLOQUEADOS.indexOf(s.estado) > -1) throw new Error('La salida está ' + ESTADOS[s.estado].toLowerCase() + '. Reabrila para editarla.');
      EDITABLES_ADMIN.forEach(function (c) { if (datos[c] !== undefined) cambios[c] = limpiar_(c, datos[c]); });
      if (s.estado === 'SOLICITADA' || s.estado === 'CAMBIOS') cambios.estado = 'BORRADOR';
    } else {
      if (s.estado !== 'SOLICITADA') throw new Error('Solo podés editar la salida mientras está pedida; después la maneja administración.');
      EDITABLES_NIVEL.forEach(function (c) { if (datos[c] !== undefined) cambios[c] = limpiar_(c, datos[c]); });
    }
    actualizarFila_('SALIDAS', s._fila, cambios);
    registrar_(u.email, s.id, 'Editó los datos', '');
    return s.id;
  });
}

/** Guarda datos + costos juntos (pantalla de presupuesto). */
function guardarPresupuesto(id, datos, items) {
  var u = usuario_();
  exigirAdmin_(u);
  datos = datos || {};
  datos.id = id;
  guardarSalida(datos);
  return conBloqueo_(function () {
    var limpios = (items || []).map(function (it, i) {
      var tipo = it.tipo === 'POR_ALUMNO' ? 'POR_ALUMNO' : 'FIJO';
      return {
        id: it.id || Utilities.getUuid().slice(0, 8), id_salida: id, orden: i + 1,
        concepto: String(it.concepto || '').trim(), detalle: String(it.detalle || '').trim(), tipo: tipo,
        cantidad: tipo === 'POR_ALUMNO' ? 1 : numero_(it.cantidad), precio: numero_(it.precio),
        mes_pago: limpiar_('mes_pago', it.mes_pago), mostrar_pdf: String(it.mostrar_pdf).toUpperCase() === 'NO' ? 'NO' : 'SI'
      };
    }).filter(function (it) { return it.concepto || it.precio; });
    reemplazarFilas_('ITEMS', function (r) { return String(r.id_salida) === String(id); }, limpios);
    registrar_(u.email, id, 'Guardó el presupuesto', limpios.length + ' costo(s)');
    return obtenerSalida(id);
  });
}

/** Genera el PDF para las familias sin cambiar el estado. */
function generarPdf(id) {
  var u = usuario_();
  exigirAdmin_(u);
  var s = buscarSalida_(id);
  var url = crearPdf_(s, itemsDe_(id), leerConfig_());
  actualizarFila_('SALIDAS', s._fila, { pdf_url: url, pdf_fecha: new Date() });
  registrar_(u.email, id, 'Generó el PDF', url);
  return url;
}

/** Genera el PDF, marca la salida como enviada y avisa al nivel. */
function enviarAlNivel(id) {
  var u = usuario_();
  exigirAdmin_(u);
  return conBloqueo_(function () {
    var s = buscarSalida_(id);
    if (BLOQUEADOS.indexOf(s.estado) > -1) throw new Error('La salida ya está ' + ESTADOS[s.estado].toLowerCase() + '.');
    var items = itemsDe_(id);
    var cfg = leerConfig_();
    var errores = calc_().controles(s, items, cfg, leerTabla_('HONORARIOS')).filter(function (c) { return c.nivel === 'error'; });
    if (errores.length) throw new Error('Antes de enviar: ' + errores.map(function (e) { return e.detalle; }).join(' '));
    var url = crearPdf_(s, items, cfg);
    actualizarFila_('SALIDAS', s._fila, {
      estado: 'ENVIADA', pdf_url: url, pdf_fecha: new Date(), actualizado_fecha: new Date(),
      comentario_nivel: '', respondido_por: '', respondido_fecha: ''
    });
    registrar_(u.email, id, 'Envió el presupuesto al nivel', url);
    var pr = calc_().presupuesto(s, items, cfg);
    avisarNivel_(s, 'Presupuesto para confirmar: ' + s.nombre,
      'Administración envió el presupuesto de «' + s.nombre + '».\n\n' +
      'Valor por alumno: ' + calc_().pesos(pr.valor) + ' en ' + pr.cuotas + ' cuota(s) de ' + calc_().pesos(pr.cuota) + '.\n' +
      'PDF: ' + url + '\n\nEntrá a la app para confirmarlo o pedir cambios.');
    return obtenerSalida(id);
  });
}

/** El nivel confirma o pide cambios. decision: 'CONFIRMADA' | 'CAMBIOS'. */
function responder(id, decision, comentario) {
  var u = usuario_();
  if (decision !== 'CONFIRMADA' && decision !== 'CAMBIOS') throw new Error('Respuesta no válida.');
  return conBloqueo_(function () {
    var s = buscarSalida_(id);
    if (!puedeVer_(u, s)) throw new Error('No tenés acceso a esta salida.');
    if (s.estado !== 'ENVIADA') throw new Error('Esta salida no tiene un presupuesto esperando respuesta.');
    comentario = String(comentario || '').trim();
    if (decision === 'CAMBIOS' && !comentario) throw new Error('Contá qué cambios necesitás.');
    actualizarFila_('SALIDAS', s._fila, {
      estado: decision, comentario_nivel: comentario, respondido_por: u.email, respondido_fecha: new Date(), actualizado_fecha: new Date()
    });
    registrar_(u.email, id, decision === 'CONFIRMADA' ? 'Confirmó el presupuesto' : 'Pidió cambios', comentario);
    avisarAdministracion_(s,
      (decision === 'CONFIRMADA' ? 'Confirmado: ' : 'Piden cambios: ') + s.nombre,
      u.nombre + (decision === 'CONFIRMADA' ? ' confirmó el presupuesto.' : ' pidió cambios:\n\n' + comentario));
    return obtenerSalida(id);
  });
}

/** Administración vuelve a abrir una salida enviada, confirmada o suspendida. */
function reabrir(id, motivo) {
  var u = usuario_();
  exigirAdmin_(u);
  return conBloqueo_(function () {
    var s = buscarSalida_(id);
    actualizarFila_('SALIDAS', s._fila, { estado: 'BORRADOR', actualizado_fecha: new Date() });
    registrar_(u.email, id, 'Reabrió la salida', motivo || ('Estaba ' + (ESTADOS[s.estado] || s.estado).toLowerCase()));
    return obtenerSalida(id);
  });
}

function suspender(id, motivo) {
  var u = usuario_();
  exigirAdmin_(u);
  return conBloqueo_(function () {
    var s = buscarSalida_(id);
    actualizarFila_('SALIDAS', s._fila, { estado: 'SUSPENDIDA', actualizado_fecha: new Date() });
    registrar_(u.email, id, 'Suspendió la salida', motivo || '');
    return obtenerSalida(id);
  });
}

/* ---------- Auxiliares ---------- */

function nuevoId_() {
  var pref = leerConfig_().prefijo_id;
  var max = 0;
  leerTabla_('SALIDAS').forEach(function (s) {
    var m = new RegExp('^' + pref + '-(\\d+)$').exec(String(s.id));
    if (m) max = Math.max(max, Number(m[1]));
  });
  return pref + '-' + ('0' + (max + 1)).slice(-2);
}

function numero_(v) {
  if (typeof v === 'number') return v;
  var t = String(v || '').replace(/\$/g, '').replace(/\s/g, '');
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else t = t.replace(/[.,](?=\d{3}(\D|$))/g, '');
  var n = Number(t);
  return isFinite(n) ? n : 0;
}

function limpiar_(col, v) {
  if (['total_alumnos', 'docentes', 'cuotas', 'alumnos_calculo'].indexOf(col) > -1) return v === '' || v === null ? '' : Math.round(numero_(v));
  if (col === 'pct_estimados') {
    if (v === '' || v === null) return '';
    var p = numero_(v);
    return p > 1 ? p / 100 : p;
  }
  if (col === 'mes_inicio_cobro' || col === 'mes_pago') {
    var m = /^(\d{4})-(\d{1,2})/.exec(String(v || ''));
    return m ? m[1] + '-' + ('0' + m[2]).slice(-2) : '';
  }
  if (col === 'pernocte') return String(v).toUpperCase() === 'SI' ? 'SI' : 'NO';
  if (col === 'nivel' && LISTAS.nivel.indexOf(v) === -1) return '';
  return typeof v === 'string' ? v.trim() : v;
}

function urlApp_() {
  try { return ScriptApp.getService().getUrl(); } catch (e) { return ''; }
}

function enviarMail_(para, asunto, cuerpo) {
  var cfg = leerConfig_();
  if (String(cfg.enviar_mails).toUpperCase() === 'NO') return;
  para = para.filter(function (x, i, a) { return x && a.indexOf(x) === i; });
  if (!para.length) return;
  var url = urlApp_();
  try {
    MailApp.sendEmail({
      to: para.join(','),
      subject: '[Viajes y Salidas] ' + asunto,
      body: cuerpo + (url ? '\n\nApp: ' + url : '') + '\n\n— ' + (cfg.nombre_colegio || '')
    });
  } catch (e) { registrar_('sistema', '', 'No se pudo enviar mail', String(e)); }
}

function avisarNivel_(s, asunto, cuerpo) {
  var para = leerTabla_('USUARIOS').filter(function (r) {
    return String(r.rol).toLowerCase() === 'nivel' && String(r.activo).toUpperCase() !== 'NO' &&
      (r.nivel === s.nivel || r.nivel === 'Todos' || s.nivel === 'Varios niveles');
  }).map(function (r) { return String(r.email).toLowerCase(); });
  if (s.responsable) para.push(String(s.responsable).toLowerCase());
  enviarMail_(para, asunto, cuerpo);
}

function avisarAdministracion_(s, asunto, cuerpo) {
  var cfg = leerConfig_();
  var para = String(cfg.mail_administracion || '').split(',').map(function (x) { return x.trim().toLowerCase(); });
  enviarMail_(para, asunto, cuerpo + '\n\nSalida: ' + (s.id || '') + ' · ' + (s.nombre || ''));
}
