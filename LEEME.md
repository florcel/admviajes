# Viajes y Salidas 2027 — Etapa 1

App web para el Colegio Alemán Córdoba. Funciona sobre una planilla de Google y se abre con la cuenta del colegio.

**Qué hace esta etapa**

- **Salidas:** administración da de alta las salidas. Cada nivel puede pedir una salida nueva.
- **Presupuesto:**
  - costos fijos y por alumno;
  - honorarios docentes tomados de la tabla;
  - porcentaje de alumnos que viajan;
  - cuotas y valor por alumno, que se recalculan en vivo.
- **Control interno**, que solo ve administración:
  - controles de datos faltantes, costos sin mes de pago, meses en negativo y cuotas posteriores al viaje;
  - cuadro de cobros y pagos mes a mes.
- **PDF para las familias:** con el logo del colegio y sin datos internos. Se guarda en una carpeta de Drive.
- **Confirmación del nivel:** el nivel recibe un mail, ve el presupuesto y lo confirma o pide cambios. Administración recibe la respuesta por mail.
- **Historial** de cada salida: quién hizo qué y cuándo.

**Probarla antes de instalar:** abrí `demo/demo.html` en el navegador. Abajo a la izquierda se elige con qué usuario verla (Administración, Nivel Primario o Nivel Secundario). Los datos de la demo se borran al recargar la página.

---

## Instalación (una vez, unos 20 minutos)

Conviene hacerla con una **cuenta institucional** (por ejemplo, la de administración) y no con una personal. La app y la planilla quedan a nombre de esa cuenta.

### 1. Crear la planilla y el proyecto

1. En Google Drive: **Nuevo › Hojas de cálculo de Google**. Ponele de nombre «Viajes y Salidas 2027 — Base».
2. En la planilla: **Extensiones › Apps Script**. Se abre el editor.
3. En el editor, **Configuración del proyecto** (el engranaje) › tildá **«Mostrar el archivo de manifiesto appsscript.json»**.

### 2. Copiar los archivos

En la carpeta `apps-script/` están todos los archivos. En el editor:

- **Archivos de código** (botón **+ › Secuencia de comandos**). Creá `Codigo`, `Datos`, `Instalar` y `Pdf`, y pegá el contenido del archivo `.gs` con el mismo nombre. Borrá el `Código.gs` que viene por defecto o reemplazá su contenido.
- **Archivos HTML** (botón **+ › HTML**). Creá `index`, `estilos`, `app`, `calc` y `pdf`, y pegá el contenido de cada `.html`.
  Los nombres tienen que ser exactamente esos, sin `.html`.
- **`appsscript.json`:** reemplazá su contenido por el del archivo del mismo nombre.
- Guardá con el ícono del disquete.

> Si alguien sabe usar la terminal, puede usar `clasp` en lugar de copiar y pegar:
> `npm i -g @google/clasp` → `clasp login` → `clasp clone <ID del script>` → copiar los archivos → `clasp push`.

### 3. Instalar

1. Arriba, en el menú de funciones, elegí **`instalar`** y tocá **▶ Ejecutar**.
2. Google pide permisos para la planilla, Drive y mail. Aceptá con la cuenta institucional.
   Si aparece «Google no verificó esta app», tocá **Configuración avanzada › Ir a (nombre del proyecto)**. Es tu propio script.
3. Se crean las hojas `SALIDAS`, `ITEMS`, `USUARIOS`, `HONORARIOS`, `CONFIG` y `LOG`, y la carpeta de Drive para los PDF.
4. Opcional: ejecutá **`cargarEjemplo`** para tener una salida de prueba (Villa General Belgrano, con los números de 2026). Después la podés borrar de `SALIDAS` y de `ITEMS`.

### 4. Configurar (en la planilla)

**Hoja `CONFIG`:**

| Clave | Qué poner |
|---|---|
| `mail_administracion` | El mail que recibe los avisos de los niveles. Si son varios, separalos con coma. |
| `pct_estimados` | El porcentaje sobre el que se calcula el presupuesto. Viene en 0,9 (90%); en 2026 pagó el 96% de los alumnos. |
| `redondeo` | 1 = sin redondeo. 100 = redondea hacia arriba a $100. |
| `logo_file_id` | El escudo para la barra de la app (ver abajo). |
| `logo_pdf_file_id` | El logo completo para el PDF (ver abajo). |
| `nota_1` a `nota_4` | El texto de «A tener en cuenta» del PDF. Se pueden agregar `nota_5` y `nota_6`. |

**Para cargar los logos:**

1. Subí a Drive los dos archivos de la carpeta `logos/`.
2. Abrí cada uno y copiá el ID que aparece en la dirección, entre `/d/` y `/view`.
3. Pegalos en `logo_file_id` (el escudo) y en `logo_pdf_file_id` (el logo completo).

**Hoja `HONORARIOS`:** tiene los valores de 2026 por cantidad de días. **Actualizalos con RRHH**. Falta el valor para **7 días**, que en la planilla 2026 tampoco estaba.

**Hoja `USUARIOS`:** una fila por persona.

| email | nombre | rol | nivel | activo |
|---|---|---|---|---|
| administracion@… | Administración | admin | Todos | SI |
| coordinacion.primario@… | Coordinación Primario | nivel | Primario | SI |

- **`admin`** ve y edita todo.
- **`nivel`** ve solo las salidas de su nivel (y las de «Varios niveles»), pide salidas nuevas y confirma presupuestos.
- Para quitarle el acceso a alguien, poné `NO` en la columna `activo`.

### 5. Publicar la app

1. En el editor: **Implementar › Nueva implementación**.
2. En tipo, elegí **Aplicación web**.
3. **Ejecutar como:** *Yo*. **Quién tiene acceso:** *Cualquier usuario de [dominio del colegio]*.
4. Tocá **Implementar** y copiá la **URL**. Ese es el link de la app para mandarle a administración y a los niveles.

**No compartas la planilla** con los niveles. Ellos entran solo por la app, que les muestra únicamente lo que les corresponde.

### Actualizar la app después de un cambio

**Implementar › Gestionar implementaciones › ✏️ › Versión: Nueva versión › Implementar.** La URL no cambia.

---

## Cómo se usa

**Estados de una salida**

- **Pedida por el nivel:** el nivel la pidió y administración todavía no la tocó.
- **En preparación:** administración arma los datos y el presupuesto.
- **Enviada al nivel:** se generó el PDF y el nivel recibió un mail para confirmar. Mientras está así, no se puede editar.
- **Confirmada:** el nivel aceptó. Para cambiar algo, administración la tiene que reabrir, y después se vuelve a enviar.
- **Cambios pedidos:** el nivel dejó un comentario. Administración corrige y la vuelve a enviar.
- **Suspendida.**

**Recorrido típico de administración**

1. **+ Nueva salida.**
2. Pestaña **Presupuesto**: cargar los costos con el mes en que se pagan, el % que viaja, las cuotas y el primer cobro.
3. **Guardar presupuesto.**
4. Pestaña **Control interno**: revisar los controles en verde o naranja y el cuadro de cobros y pagos. Si algún mes queda en negativo, probar otro primer cobro u otra cantidad de cuotas.
5. **Enviar al nivel.**

**Qué ve cada uno en el PDF y en la vista del nivel:** los conceptos tildados en la columna PDF, el valor por alumno y las cuotas. No aparecen los precios de cada concepto, los meses de pago ni las notas internas.

---

## Límites y cosas a saber

- **Mails:** Google Workspace permite unos 1.500 por día, mucho más de lo que se necesita.
- **Márgenes del PDF:** Google convierte el PDF desde HTML. Revisá el primero que generes; si hay que ajustar márgenes o tamaños, se hace en `pdf.html`.
- **Pedidos de los niveles:** cuando un nivel pide una salida, solo carga los datos básicos. El presupuesto lo arma siempre administración.
- **No incluye todavía** (son las etapas 2 y 3): la carpeta DIGPE, el portal de transporte, la autorización para las familias, la importación del mayor, el balance y las novedades de alumnos. Están en el prototipo y se suman sobre esta misma base.
- **Antes de entregarla:** probé la app completa con una simulación de Google Sheets, Drive y Mail. Probé los recorridos de administración y de los niveles, los permisos entre niveles, los cálculos (dan igual que la planilla 2026) y el contenido del PDF. **Falta probarla instalada en la cuenta real del colegio**: hacé una salida de prueba completa, de punta a punta, antes de compartir el link.
