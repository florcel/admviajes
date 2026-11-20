/**
 * Acceso a la planilla: leer y escribir tablas por nombre de columna.
 */

var COLS_FECHA = ['fecha_salida', 'fecha_regreso', 'respondido_fecha', 'pdf_fecha', 'creado_fecha', 'actualizado_fecha', 'fecha'];
var COLS_MES = ['mes_inicio_cobro', 'mes_pago'];
var COLS_FECHAHORA = ['respondido_fecha', 'pdf_fecha', 'creado_fecha', 'actualizado_fecha', 'fecha'];
var TZ = 'America/Argentina/Cordoba';

function planilla_() {
  var id = PropertiesService.getScriptProperties().getProperty('SS_ID');
  if (id) return SpreadsheetApp.openById(id);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('La app no está instalada: ejecutá «instalar» desde el editor.');
  return ss;
}

function hoja_(nombre) {
  var sh = planilla_().getSheetByName(nombre);
  if (!sh) throw new Error('Falta la hoja ' + nombre + ': ejecutá «instalar».');
  return sh;
}

function cabecera_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
}

/** Devuelve las filas como objetos. Fechas → 'yyyy-MM-dd', meses → 'yyyy-MM'. Agrega _fila (número de fila). */
function leerTabla_(nombre) {
  var sh = hoja_(nombre);
  var n = sh.getLastRow();
  if (n < 2) return [];
  var cab = cabecera_(sh);
  var valores = sh.getRange(2, 1, n - 1, cab.length).getValues();
  var out = [];
  valores.forEach(function (fila, i) {
    if (fila.every(function (v) { return v === '' || v === null; })) return;
    var o = { _fila: i + 2 };
    cab.forEach(function (c, j) { o[c] = normalizar_(c, fila[j]); });
    out.push(o);
  });
  return out;
}

function normalizar_(col, v) {
  if (v instanceof Date) {
    if (COLS_MES.indexOf(col) > -1) return Utilities.formatDate(v, TZ, 'yyyy-MM');
    if (COLS_FECHAHORA.indexOf(col) > -1) {
      return Utilities.formatDate(v, TZ, "yyyy-MM-dd'T'HH:mm");
    }
    return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  }
  if (COLS_MES.indexOf(col) > -1 && v !== '' && v !== null) {
    var m = /^(\d{4})-(\d{1,2})/.exec(String(v));
    return m ? m[1] + '-' + ('0' + m[2]).slice(-2) : '';
  }
  return v;
}

/** Convierte un valor del cliente al formato de la celda. */
function aCelda_(col, v) {
  if (v === undefined || v === null) return '';
  if (COLS_FECHA.indexOf(col) > -1) {
    if (v instanceof Date) return v;
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(String(v));
    if (!m) return '';
    return new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 12, m[5] ? +m[5] : 0);
  }
  return v;
}

function filaDesdeObjeto_(cab, obj) {
  return cab.map(function (c) { return aCelda_(c, obj[c]); });
}

function agregarFila_(nombre, obj) {
  var sh = hoja_(nombre);
  var cab = cabecera_(sh);
  var fila = filaDesdeObjeto_(cab, obj);
  var r = sh.getLastRow() + 1;
  sh.getRange(r, 1, 1, cab.length).setValues([fila]);
  return r;
}

/** Actualiza solo las columnas presentes en «cambios». */
function actualizarFila_(nombre, numFila, cambios) {
  var sh = hoja_(nombre);
  var cab = cabecera_(sh);
  var rango = sh.getRange(numFila, 1, 1, cab.length);
  var fila = rango.getValues()[0];
  cab.forEach(function (c, j) {
    if (Object.prototype.hasOwnProperty.call(cambios, c)) fila[j] = aCelda_(c, cambios[c]);
  });
  rango.setValues([fila]);
}

/** Reemplaza todas las filas de una tabla que cumplen «filtro» por «nuevas». */
function reemplazarFilas_(nombre, filtro, nuevas) {
  var sh = hoja_(nombre);
  var cab = cabecera_(sh);
  var actuales = leerTabla_(nombre).filter(function (r) { return !filtro(r); });
  var todas = actuales.concat(nuevas).map(function (o) { return filaDesdeObjeto_(cab, o); });
  var n = sh.getLastRow();
  if (n > 1) sh.getRange(2, 1, n - 1, cab.length).clearContent();
  if (todas.length) sh.getRange(2, 1, todas.length, cab.length).setValues(todas);
}

function leerConfig_() {
  var cfg = {};
  leerTabla_('CONFIG').forEach(function (r) { cfg[String(r.clave).trim()] = r.valor; });
  cfg.anio = Number(cfg.anio) || new Date().getFullYear();
  cfg.pct_estimados = Number(cfg.pct_estimados) || 0.9;
  cfg.redondeo = Number(cfg.redondeo) || 1;
  cfg.prefijo_id = String(cfg.prefijo_id || ('V' + String(cfg.anio).slice(-2)));
  return cfg;
}

function escribirConfig_(clave, valor) {
  var fila = leerTabla_('CONFIG').filter(function (r) { return r.clave === clave; })[0];
  if (fila) actualizarFila_('CONFIG', fila._fila, { valor: valor });
  else agregarFila_('CONFIG', { clave: clave, valor: valor, descripcion: '' });
}

function registrar_(usuario, idSalida, accion, detalle) {
  try {
    agregarFila_('LOG', { fecha: new Date(), usuario: usuario, id_salida: idSalida, accion: accion, detalle: detalle || '' });
  } catch (e) { /* el registro nunca debe frenar la operación */ }
}

function conBloqueo_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Otra persona está guardando en este momento. Probá de nuevo en unos segundos.');
  try { return fn(); } finally { lock.releaseLock(); }
}
