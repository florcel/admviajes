/**
 * VIAJES Y SALIDAS — Etapa 1
 * Instalación: crea las hojas, la configuración y la carpeta de PDFs.
 * Se ejecuta UNA vez desde el editor: seleccionar la función «instalar» y tocar ▶ Ejecutar.
 * Volver a ejecutarla no borra datos: solo agrega lo que falte.
 */

var ESQUEMA = {
  SALIDAS: [
    'id', 'nombre', 'destino', 'nivel', 'curso', 'fecha_salida', 'fecha_regreso', 'pernocte',
    'total_alumnos', 'docentes', 'transporte', 'responsable', 'pct_estimados', 'alumnos_calculo',
    'cuotas', 'mes_inicio_cobro', 'estado', 'comentario_nivel', 'respondido_por', 'respondido_fecha',
    'pdf_url', 'pdf_fecha', 'creado_por', 'creado_fecha', 'actualizado_fecha', 'notas_internas',
    'variante_activa', 'pdf_escenarios'
  ],
  VARIANTES: ['id_salida', 'variante', 'nombre', 'pct_estimados', 'alumnos_calculo', 'cuotas', 'mes_inicio_cobro'],
  ITEMS: ['id', 'id_salida', 'orden', 'concepto', 'detalle', 'tipo', 'cantidad', 'precio', 'mes_pago', 'mostrar_pdf', 'variante', 'pagos'],
  HISTORIAL: ['origen', 'anio', 'fecha', 'total_alumnos', 'concepto', 'tipo', 'cantidad', 'precio'],
  USUARIOS: ['email', 'nombre', 'rol', 'nivel', 'activo'],
  HONORARIOS: ['dias', 'honorario_por_docente'],
  CONFIG: ['clave', 'valor', 'descripcion'],
  LOG: ['fecha', 'usuario', 'id_salida', 'accion', 'detalle']
};

var CONFIG_INICIAL = [
  ['nombre_colegio', 'Colegio Alemán Córdoba', 'Sale en el encabezado de la app y de los PDF'],
  ['anio', 2027, 'Año lectivo'],
  ['prefijo_id', 'V27', 'Prefijo de los ID de salida (V27-01, V27-02…)'],
  ['pct_estimados', 0.9, 'Porcentaje de alumnos sobre el que se calcula el presupuesto (0,9 = 90%). En 2026 pagó el 96%.'],
  ['redondeo', 1,'Redondeo hacia arriba del valor por alumno y de la cuota ($1 = sin redondeo)'],
  ['mail_administracion', '', 'Mail que recibe los avisos de los niveles (separar varios con coma)'],
  ['enviar_mails', 'SI', 'SI / NO: avisos automáticos por mail'],
  ['carpeta_pdf_id', '', 'Se completa sola al instalar'],
  ['logo_file_id', '', 'ID en Drive del escudo (PNG) que aparece en la barra de la app'],
  ['logo_pdf_file_id', '', 'ID en Drive del logo completo (Colegio Alemán + IB) para el PDF de las familias'],
  ['nota_1', 'Este presupuesto queda supeditado al control desde administración. Las opciones de cuotas son para determinados viajes únicamente. Siempre se redondea el valor total del viaje para hacerlo más simple.', 'Nota del PDF para las familias'],
  ['nota_2', 'Cotizamos con menos asistentes de los que suelen viajar, para en todo caso devolver diferencias y no tener que cobrar de más luego a las familias.', 'Nota del PDF para las familias'],
  ['nota_3', 'De ser necesario, en las dos últimas cuotas o en el mes posterior al viaje se ajustará el valor a facturar, en caso de haber una variación considerable en la cotización del transporte o paquete, o alguna modificación en la cantidad de alumnos que viajen. Se facturará en el caso de corresponder una diferencia.', 'Nota del PDF para las familias'],
  ['nota_4', 'En caso de que el alumno, habiendo autorizado a facturarle el viaje, por alguna razón extraordinaria no viajara, el importe del viaje NO se reintegra, ya que los viajes se contratan y abonan con antelación.', 'Nota del PDF para las familias']
];

// Valores 2026 tomados de la planilla. Actualizar con RRHH antes de usar.
var HONORARIOS_INICIALES = [
  [1, 72290], [2, 223683], [3, 362298], [4, 450656], [5, 691852], [6, 729419], [7, ''], [8, 796283], [9, 1094451]
];

var LISTAS = {
  nivel: ['Inicial', 'Primario', 'Secundario', 'Varios niveles'],
  rol: ['admin', 'nivel'],
  nivelUsuario: ['Inicial', 'Primario', 'Secundario', 'Todos'],
  siNo: ['SI', 'NO'],
  tipo: ['FIJO', 'POR_ALUMNO'],
  estado: ['SOLICITADA', 'BORRADOR', 'ENVIADA', 'CONFIRMADA', 'CAMBIOS', 'SUSPENDIDA']
};

function instalar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Abrí el editor desde la planilla (Extensiones › Apps Script) y volvé a ejecutar.');
  PropertiesService.getScriptProperties().setProperty('SS_ID', ss.getId());

  Object.keys(ESQUEMA).forEach(function (nombre) {
    var sh = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
    var cab = ESQUEMA[nombre];
    var actual = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
    cab.forEach(function (col) {
      if (actual.indexOf(col) === -1) {
        sh.getRange(1, actual.length + 1).setValue(col);
        actual.push(col);
      }
    });
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, actual.length).setFontWeight('bold').setBackground('#16181D').setFontColor('#FFFFFF');
  });

  // Columnas de texto: evitar que Sheets convierta «2027-07» o «V27-01» en fechas o números.
  formatoTexto_(ss.getSheetByName('SALIDAS'), ['id', 'mes_inicio_cobro', 'responsable']);
  formatoTexto_(ss.getSheetByName('ITEMS'), ['id', 'id_salida', 'mes_pago', 'variante', 'pagos']);
  formatoTexto_(ss.getSheetByName('VARIANTES'), ['id_salida', 'variante', 'mes_inicio_cobro']);
  formatoTexto_(ss.getSheetByName('HISTORIAL'), ['origen', 'fecha']);
  formatoFecha_(ss.getSheetByName('SALIDAS'), ['fecha_salida', 'fecha_regreso']);

  validacion_(ss.getSheetByName('SALIDAS'), 'nivel', LISTAS.nivel);
  validacion_(ss.getSheetByName('SALIDAS'), 'pernocte', LISTAS.siNo);
  validacion_(ss.getSheetByName('SALIDAS'), 'estado', LISTAS.estado);
  validacion_(ss.getSheetByName('SALIDAS'), 'pdf_escenarios', LISTAS.siNo);
  validacion_(ss.getSheetByName('ITEMS'), 'tipo', LISTAS.tipo);
  validacion_(ss.getSheetByName('ITEMS'), 'mostrar_pdf', LISTAS.siNo);
  validacion_(ss.getSheetByName('USUARIOS'), 'rol', LISTAS.rol);
  validacion_(ss.getSheetByName('USUARIOS'), 'nivel', LISTAS.nivelUsuario);
  validacion_(ss.getSheetByName('USUARIOS'), 'activo', LISTAS.siNo);

  var cfg = ss.getSheetByName('CONFIG');
  var claves = leerTabla_('CONFIG').map(function (r) { return r.clave; });
  CONFIG_INICIAL.forEach(function (fila) {
    if (claves.indexOf(fila[0]) === -1) cfg.appendRow(fila);
  });

  var hon = ss.getSheetByName('HONORARIOS');
  if (hon.getLastRow() < 2) hon.getRange(2, 1, HONORARIOS_INICIALES.length, 2).setValues(HONORARIOS_INICIALES);

  var usr = ss.getSheetByName('USUARIOS');
  var yo = Session.getEffectiveUser().getEmail();
  if (usr.getLastRow() < 2 && yo) usr.appendRow([yo, 'Administración', 'admin', 'Todos', 'SI']);

  if (!leerConfig_().carpeta_pdf_id) {
    var carpeta = DriveApp.createFolder('Viajes y Salidas ' + leerConfig_().anio + ' — PDFs');
    escribirConfig_('carpeta_pdf_id', carpeta.getId());
  }

  if (ss.getSheetByName('HISTORIAL').getLastRow() < 2) cargarHistorial();

  var hoja1 = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (hoja1 && hoja1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(hoja1);

  SpreadsheetApp.flush();
  Logger.log('Listo. Ahora: Implementar › Nueva implementación › Aplicación web.');
}

function formatoTexto_(sh, cols) {
  var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  cols.forEach(function (c) {
    var i = cab.indexOf(c);
    if (i > -1) sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@');
  });
}

function formatoFecha_(sh, cols) {
  var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  cols.forEach(function (c) {
    var i = cab.indexOf(c);
    if (i > -1) sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat('dd/mm/yyyy');
  });
}

function validacion_(sh, col, lista) {
  var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var i = cab.indexOf(col);
  if (i === -1) return;
  var regla = SpreadsheetApp.newDataValidation().requireValueInList(lista, true).setAllowInvalid(false).build();
  sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setDataValidation(regla);
}

/**
 * Opcional: carga la salida de ejemplo de 2026 (Villa General Belgrano) para probar.
 * Se puede borrar después desde la hoja SALIDAS e ITEMS.
 */
function cargarEjemplo() {
  var cfg = leerConfig_();
  var id = cfg.prefijo_id + '-00';
  if (leerTabla_('SALIDAS').some(function (s) { return s.id === id; })) return;
  var ahora = new Date();
  agregarFila_('SALIDAS', {
    id: id, nombre: 'Villa General Belgrano (ejemplo)', destino: 'Villa General Belgrano', nivel: 'Primario',
    curso: '4° grado', fecha_salida: (cfg.anio) + '-11-26', fecha_regreso: (cfg.anio) + '-11-27', pernocte: 'SI',
    total_alumnos: 66, docentes: 7, transporte: 'Beggia Turismo', responsable: '', pct_estimados: 0.8,
    alumnos_calculo: '', cuotas: 4, mes_inicio_cobro: cfg.anio + '-07', estado: 'BORRADOR', variante_activa: 'A', pdf_escenarios: 'NO',
    creado_por: Session.getEffectiveUser().getEmail(), creado_fecha: ahora, actualizado_fecha: ahora,
    notas_internas: 'Datos del viaje V26-18 de 2026, cargados como ejemplo.'
  });
  agregarFila_('VARIANTES', { id_salida: id, variante: 'A', nombre: 'Con Beggia Turismo', pct_estimados: 0.8, alumnos_calculo: '', cuotas: 4, mes_inicio_cobro: cfg.anio + '-07' });
  var y = cfg.anio;
  // Plan de pagos como en la planilla 2026: seña del 20% en julio y saldo en septiembre; transporte en 4 partes.
  var items = [
    ['Docentes acompañantes', '7 docentes · 2 días', 'FIJO', 7, 223683, '', y + '-11:100', 'SI'],
    ['Transporte', '2 coches · Beggia Turismo (incluye hotel de choferes)', 'FIJO', 1, 4333600, '', y + '-07:25;' + y + '-08:25;' + y + '-09:25;' + y + '-10:25', 'SI'],
    ['Hotel docentes', '', 'FIJO', 7, 96800, '', y + '-07:20;' + y + '-09:80', 'NO'],
    ['Almuerzo Quaras choferes y docentes', '', 'FIJO', 9, 26257, '', y + '-07:20;' + y + '-09:80', 'NO'],
    ['Guía city tour', '', 'FIJO', 1, 300000, '', y + '-09:100', 'SI'],
    ['Parque Quaras con almuerzo', '', 'POR_ALUMNO', 1, 66066, '', y + '-07:20;' + y + '-09:80', 'SI'],
    ['Hotel (alojamiento y comidas)', '', 'POR_ALUMNO', 1, 96800, '', y + '-07:20;' + y + '-09:80', 'SI']
  ];
  items.forEach(function (it, i) {
    agregarFila_('ITEMS', {
      id: Utilities.getUuid().slice(0, 8), id_salida: id, orden: i + 1, concepto: it[0], detalle: it[1],
      tipo: it[2], cantidad: it[3], precio: it[4], mes_pago: it[6].slice(0, 7), mostrar_pdf: it[7], variante: 'A', pagos: it[6]
    });
  });
}

/** Carga el historial de presupuestos 2022–2026 (archivo HistorialDatos.gs) en la hoja HISTORIAL. */
function cargarHistorial() {
  if (typeof HISTORIAL_INICIAL === 'undefined' || !HISTORIAL_INICIAL.length) return;
  var sh = hoja_('HISTORIAL');
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, ESQUEMA.HISTORIAL.length).clearContent();
  sh.getRange(2, 1, HISTORIAL_INICIAL.length, ESQUEMA.HISTORIAL.length).setValues(HISTORIAL_INICIAL);
}
