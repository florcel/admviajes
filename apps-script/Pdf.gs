/**
 * PDF del presupuesto para las familias.
 * Se arma con la plantilla pdf.html y se guarda en la carpeta de Drive indicada en CONFIG (carpeta_pdf_id).
 * No incluye nada del control interno: ni precios por concepto, ni meses de pago, ni notas internas.
 */

function crearPdf_(s, items, cfg) {
  var C = calc_();
  var pr = C.presupuesto(s, items, cfg);
  var t = HtmlService.createTemplateFromFile('pdf');
  t.d = {
    colegio: cfg.nombre_colegio || '',
    anio: cfg.anio,
    logo: imagenDataUri_(cfg.logo_pdf_file_id || cfg.logo_file_id),
    id: s.id,
    nombre: s.nombre,
    nivel: s.nivel,
    curso: s.curso,
    fechas: textoFechas_(s.fecha_salida, s.fecha_regreso),
    duracion: textoDuracion_(C.dias(s), s.pernocte),
    transporte: s.transporte,
    docentes: Number(s.docentes) || 0,
    incluye: items.filter(function (it) { return String(it.mostrar_pdf).toUpperCase() !== 'NO' && it.concepto; })
      .map(function (it) { return it.concepto; }),
    valor: C.pesos(pr.valor),
    cuotas: pr.cuotas,
    cuota: C.pesos(pr.cuota),
    periodo: pr.cuotas === 1 ? 'Un pago en ' + C.nombreMes(pr.mesInicio, true)
      : pr.cuotas + ' cuotas mensuales de ' + C.pesos(pr.cuota) + ', de ' + C.nombreMes(pr.mesInicio) + ' a ' + C.nombreMes(pr.mesFin, true),
    notas: ['nota_1', 'nota_2', 'nota_3', 'nota_4', 'nota_5', 'nota_6'].map(function (k) { return cfg[k]; }).filter(function (x) { return x && String(x).trim(); })
  };
  var html = t.evaluate().getContent();
  var nombreArchivo = s.id + ' ' + s.nombre + ' — Presupuesto ' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH.mm') + '.pdf';
  var pdf = Utilities.newBlob(html, 'text/html', 'presupuesto.html').getAs('application/pdf').setName(nombreArchivo);
  var carpeta = cfg.carpeta_pdf_id ? DriveApp.getFolderById(cfg.carpeta_pdf_id) : DriveApp.getRootFolder();
  var archivo = carpeta.createFile(pdf);
  try { archivo.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { /* cuentas fuera de Workspace */ }
  return archivo.getUrl();
}

function imagenDataUri_(fileId) {
  if (!fileId) return '';
  try {
    var blob = DriveApp.getFileById(String(fileId).trim()).getBlob();
    return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
  } catch (e) {
    return '';
  }
}

function logoDataUri_(cfg) {
  return imagenDataUri_(cfg.logo_file_id);
}

function textoFechas_(a, b) {
  var C = calc_();
  var pa = /^(\d{4})-(\d{2})-(\d{2})/.exec(a || ''), pb = /^(\d{4})-(\d{2})-(\d{2})/.exec(b || '');
  if (!pa) return '';
  var mesA = C.MESES[+pa[2] - 1];
  if (!pb || a === b) return +pa[3] + ' de ' + mesA + ' de ' + pa[1];
  var mesB = C.MESES[+pb[2] - 1];
  if (pa[2] === pb[2] && pa[1] === pb[1]) {
    var dif = Math.round((new Date(+pb[1], +pb[2] - 1, +pb[3]) - new Date(+pa[1], +pa[2] - 1, +pa[3])) / 86400000);
    return (dif === 1 ? +pa[3] + ' y ' : 'Del ' + +pa[3] + ' al ') + +pb[3] + ' de ' + mesB + ' de ' + pb[1];
  }
  return 'Del ' + +pa[3] + ' de ' + mesA + ' al ' + +pb[3] + ' de ' + mesB + ' de ' + pb[1];
}

function textoDuracion_(dias, pernocte) {
  if (!dias) return '';
  if (dias === 1) return String(pernocte).toUpperCase() === 'SI' ? '1 día, con pernocte' : '1 día, sin pernocte';
  return dias + ' días' + (String(pernocte).toUpperCase() === 'NO' ? ', sin pernocte' : ', con pernocte');
}
