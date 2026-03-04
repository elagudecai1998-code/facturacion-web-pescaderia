/* ==============================================
   HERRAMIENTA DE FACTURACIÓN — LÓGICA (app.js)
   ============================================== */

// ──────────────────────────────────────────────
// CONFIGURACIÓN
// URL del webhook donde se enviarán los datos.
// Cambia esta URL por la de tu webhook real.
// ──────────────────────────────────────────────
const WEBHOOK_URL = 'https://n8n-production-0b2e.up.railway.app/webhook/factura';

// ──────────────────────────────────────────────
// REFERENCIAS AL DOM
// ──────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Cabecera
const elNumeroFactura = $('#numero-factura');
const elFechaFactura = $('#fecha-factura');

// Cliente
const elSelectorCliente = $('#selector-cliente');
const elClienteNombre = $('#cliente-nombre');
const elClienteDni = $('#cliente-dni');
const elClienteDireccion = $('#cliente-direccion');
const elClienteCiudad = $('#cliente-ciudad');
const elClienteCp = $('#cliente-cp');

// Nuevo cliente
const elBtnToggleNuevoCliente = $('#btn-toggle-nuevo-cliente');
const elNuevoClienteForm = $('#nuevo-cliente-form');
const elNuevoNombre = $('#nuevo-nombre');
const elNuevoDni = $('#nuevo-dni');
const elNuevoDireccion = $('#nuevo-direccion');
const elNuevoCiudad = $('#nuevo-ciudad');
const elNuevoCp = $('#nuevo-cp');
const elBtnGuardarCliente = $('#btn-guardar-cliente');
const elBtnCancelarCliente = $('#btn-cancelar-cliente');

// Productos
const elLineasProducto = $('#lineas-producto');
const elBtnAñadirProducto = $('#btn-añadir-producto');

// Resumen
const elResumenSubtotal = $('#resumen-subtotal');
const elResumenIvaProductos = $('#resumen-iva-productos');
const elPorteValor = $('#porte-valor');
const elResumenPorte = $('#resumen-porte');
const elResumenIvaPorte = $('#resumen-iva-porte');
const elResumenTotal = $('#resumen-total');

// Envío
const elBtnGenerar = $('#btn-generar-factura');
const elEstadoEnvio = $('#estado-envio');

// ──────────────────────────────────────────────
// ESTADO DE LA APLICACIÓN
// ──────────────────────────────────────────────
let clientes = []; // Array de objetos { nombre, dni, direccion, ciudad, cp }
let contadorLineas = 0; // Para IDs únicos de cada línea

// ──────────────────────────────────────────────
// INICIALIZACIÓN
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Cargar clientes desde localStorage
  cargarClientes();

  // Establecer la fecha de hoy por defecto
  const hoy = new Date().toISOString().split('T')[0];
  elFechaFactura.value = hoy;

  // Añadir la primera línea de producto
  añadirLineaProducto();

  // Registrar eventos
  registrarEventos();
});

// ──────────────────────────────────────────────
// GESTIÓN DE CLIENTES
// ──────────────────────────────────────────────

/**
 * Carga los clientes almacenados en localStorage
 * y rellena el desplegable.
 */
function cargarClientes() {
  const datos = localStorage.getItem('facturas_clientes');
  if (datos) {
    try {
      clientes = JSON.parse(datos);
    } catch (e) {
      // Si los datos están corruptos, empezamos de cero
      clientes = [];
    }
  }
  actualizarDesplegableClientes();
}

/**
 * Guarda el array de clientes en localStorage.
 */
function guardarClientes() {
  localStorage.setItem('facturas_clientes', JSON.stringify(clientes));
}

/**
 * Reconstruye las opciones del desplegable de clientes.
 */
function actualizarDesplegableClientes() {
  // Mantener la opción por defecto
  elSelectorCliente.innerHTML = '<option value="">— Elige un cliente —</option>';

  clientes.forEach((cliente, indice) => {
    const opcion = document.createElement('option');
    opcion.value = indice;
    opcion.textContent = cliente.nombre;
    elSelectorCliente.appendChild(opcion);
  });
}

/**
 * Autocompleta los campos del cliente según la selección.
 */
function seleccionarCliente() {
  const indice = elSelectorCliente.value;

  if (indice === '') {
    // Limpiar campos
    elClienteNombre.value = '';
    elClienteDni.value = '';
    elClienteDireccion.value = '';
    elClienteCiudad.value = '';
    elClienteCp.value = '';
    return;
  }

  const cliente = clientes[parseInt(indice)];
  if (!cliente) return;

  elClienteNombre.value = cliente.nombre;
  elClienteDni.value = cliente.dni;
  elClienteDireccion.value = cliente.direccion;
  elClienteCiudad.value = cliente.ciudad;
  elClienteCp.value = cliente.cp;
}

/**
 * Muestra u oculta el formulario de nuevo cliente.
 */
function toggleNuevoCliente() {
  const visible = !elNuevoClienteForm.hidden;
  elNuevoClienteForm.hidden = visible;

  if (!visible) {
    // Limpiar campos al abrir
    elNuevoNombre.value = '';
    elNuevoDni.value = '';
    elNuevoDireccion.value = '';
    elNuevoCiudad.value = '';
    elNuevoCp.value = '';
    elNuevoNombre.focus();
  }
}

/**
 * Guarda un nuevo cliente, lo añade al desplegable
 * y lo persiste en localStorage.
 */
function guardarNuevoCliente() {
  const nombre = elNuevoNombre.value.trim();
  const dni = elNuevoDni.value.trim();
  const direccion = elNuevoDireccion.value.trim();
  const ciudad = elNuevoCiudad.value.trim();
  const cp = elNuevoCp.value.trim();

  // Validación básica: el nombre es obligatorio
  if (!nombre) {
    mostrarToast('El nombre del cliente es obligatorio.', 'error');
    elNuevoNombre.focus();
    return;
  }

  // Crear el objeto cliente
  const nuevoCliente = { nombre, dni, direccion, ciudad, cp };
  clientes.push(nuevoCliente);

  // Guardar y actualizar UI
  guardarClientes();
  actualizarDesplegableClientes();

  // Seleccionar automáticamente el nuevo cliente
  elSelectorCliente.value = clientes.length - 1;
  seleccionarCliente();

  // Ocultar el formulario
  elNuevoClienteForm.hidden = true;

  mostrarToast(`Cliente "${nombre}" guardado correctamente.`, 'exito');
}

// ──────────────────────────────────────────────
// LÍNEAS DE PRODUCTO
// ──────────────────────────────────────────────

/**
 * Crea y añade una nueva línea de producto al contenedor.
 */
function añadirLineaProducto() {
  contadorLineas++;
  const id = contadorLineas;

  // Crear el contenedor de la línea
  const div = document.createElement('div');
  div.classList.add('linea-producto');
  div.dataset.id = id;

  div.innerHTML = `
    <div class="linea-producto-header">
      <span class="linea-numero">Línea ${id}</span>
      <button type="button" class="btn btn-danger-sm btn-eliminar-linea" data-id="${id}">✕ Eliminar</button>
    </div>
    <div class="linea-campos">
      <div class="form-group">
        <label>Cajas</label>
        <input type="number" class="campo-cajas" placeholder="0" min="0" step="1" />
      </div>
      <div class="form-group">
        <label>Especie</label>
        <input type="text" class="campo-especie" placeholder="Ej: Merluza" />
      </div>
      <div class="form-group">
        <label>Kilos</label>
        <input type="number" class="campo-kilos" placeholder="0,00" min="0" step="0.01" />
      </div>
      <div class="form-group">
        <label>Precio / kg (€)</label>
        <input type="number" class="campo-precio" placeholder="0,00" min="0" step="0.01" />
      </div>
    </div>
    <div class="linea-total-display">
      <span>Total línea:</span> <strong class="campo-total-linea">0,00 €</strong>
    </div>
  `;

  elLineasProducto.appendChild(div);

  // Registrar eventos de la nueva línea
  const inputKilos = div.querySelector('.campo-kilos');
  const inputPrecio = div.querySelector('.campo-precio');

  inputKilos.addEventListener('input', () => recalcularLinea(div));
  inputPrecio.addEventListener('input', () => recalcularLinea(div));

  // Botón eliminar
  const btnEliminar = div.querySelector('.btn-eliminar-linea');
  btnEliminar.addEventListener('click', () => eliminarLineaProducto(div));
}

/**
 * Recalcula el total de una línea individual
 * y después actualiza el resumen global.
 */
function recalcularLinea(divLinea) {
  const kilos = parseFloat(divLinea.querySelector('.campo-kilos').value) || 0;
  const precio = parseFloat(divLinea.querySelector('.campo-precio').value) || 0;
  const total = kilos * precio;

  divLinea.querySelector('.campo-total-linea').textContent = formatearMoneda(total);

  recalcularResumen();
}

/**
 * Elimina una línea de producto con animación.
 */
function eliminarLineaProducto(divLinea) {
  // Verificar que quede al menos una línea
  const totalLineas = elLineasProducto.querySelectorAll('.linea-producto').length;
  if (totalLineas <= 1) {
    mostrarToast('Debe haber al menos una línea de producto.', 'error');
    return;
  }

  // Animación de salida
  divLinea.classList.add('removing');
  setTimeout(() => {
    divLinea.remove();
    renumerarLineas();
    recalcularResumen();
  }, 300);
}

/**
 * Renumera las etiquetas de las líneas tras eliminar una.
 */
function renumerarLineas() {
  const lineas = elLineasProducto.querySelectorAll('.linea-producto');
  lineas.forEach((linea, i) => {
    linea.querySelector('.linea-numero').textContent = `Línea ${i + 1}`;
  });
}

// ──────────────────────────────────────────────
// CÁLCULOS DEL RESUMEN
// ──────────────────────────────────────────────

/**
 * Recalcula todos los totales de la factura.
 */
function recalcularResumen() {
  // Subtotal = suma de todas las líneas
  let subtotal = 0;
  const lineas = elLineasProducto.querySelectorAll('.linea-producto');
  lineas.forEach((linea) => {
    const kilos = parseFloat(linea.querySelector('.campo-kilos').value) || 0;
    const precio = parseFloat(linea.querySelector('.campo-precio').value) || 0;
    subtotal += kilos * precio;
  });

  // IVA productos = 10% del subtotal
  const ivaProductos = subtotal * 0.10;

  // Porte = valor manual
  const porte = parseFloat(elPorteValor.value) || 0;

  // IVA porte = 21% del porte
  const ivaPorte = porte * 0.21;

  // Total factura
  const totalFactura = subtotal + ivaProductos + porte + ivaPorte;

  // Actualizar la interfaz
  elResumenSubtotal.textContent = formatearMoneda(subtotal);
  elResumenIvaProductos.textContent = formatearMoneda(ivaProductos);
  elResumenPorte.textContent = formatearMoneda(porte);
  elResumenIvaPorte.textContent = formatearMoneda(ivaPorte);
  elResumenTotal.textContent = formatearMoneda(totalFactura);
}

// ──────────────────────────────────────────────
// ENVÍO AL WEBHOOK
// ──────────────────────────────────────────────

/**
 * Recopila todos los datos de la factura y los envía
 * por POST al webhook configurado.
 */
async function generarFactura() {
  // Validaciones básicas
  const numeroFactura = elNumeroFactura.value.trim();
  const fechaFactura = elFechaFactura.value;

  if (!numeroFactura) {
    mostrarToast('Introduce el número de factura.', 'error');
    elNumeroFactura.focus();
    return;
  }

  if (!fechaFactura) {
    mostrarToast('Selecciona la fecha de la factura.', 'error');
    elFechaFactura.focus();
    return;
  }

  if (!elClienteNombre.value.trim()) {
    mostrarToast('Selecciona o crea un cliente.', 'error');
    elSelectorCliente.focus();
    return;
  }

  // Recopilar líneas de producto
  const lineas = [];
  const divLineas = elLineasProducto.querySelectorAll('.linea-producto');

  divLineas.forEach((div) => {
    const cajas = parseInt(div.querySelector('.campo-cajas').value) || 0;
    const especie = div.querySelector('.campo-especie').value.trim();
    const kilos = parseFloat(div.querySelector('.campo-kilos').value) || 0;
    const precioKg = parseFloat(div.querySelector('.campo-precio').value) || 0;
    const totalLinea = kilos * precioKg;

    lineas.push({ cajas, especie, kilos, precioKg, totalLinea });
  });

  // Verificar que al menos una línea tenga datos
  const hayDatos = lineas.some((l) => l.especie || l.kilos > 0);
  if (!hayDatos) {
    mostrarToast('Añade al menos un producto con datos.', 'error');
    return;
  }

  // Calcular totales
  const subtotal = lineas.reduce((acc, l) => acc + l.totalLinea, 0);
  const ivaProductos = subtotal * 0.10;
  const porte = parseFloat(elPorteValor.value) || 0;
  const ivaPorte = porte * 0.21;
  const totalFactura = subtotal + ivaProductos + porte + ivaPorte;

  // Construir objeto JSON
  const datosFactura = {
    factura: {
      numero: numeroFactura,
      fecha: fechaFactura,
    },
    cliente: {
      nombre: elClienteNombre.value.trim(),
      dni: elClienteDni.value.trim(),
      direccion: elClienteDireccion.value.trim(),
      ciudad: elClienteCiudad.value.trim(),
      codigoPostal: elClienteCp.value.trim(),
    },
    productos: lineas,
    resumen: {
      subtotal: redondear(subtotal),
      ivaProductos: redondear(ivaProductos),
      porte: redondear(porte),
      ivaPorte: redondear(ivaPorte),
      totalFactura: redondear(totalFactura),
    },
  };

  // Enviar al webhook
  actualizarEstadoEnvio('Enviando…', 'enviando');
  elBtnGenerar.disabled = true;

  try {
    const respuesta = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datosFactura),
    });

    if (respuesta.ok) {
      actualizarEstadoEnvio('✅ Factura generada con éxito.', 'exito');
      mostrarToast('Factura enviada correctamente.', 'exito');
    } else {
      actualizarEstadoEnvio(`❌ Error del servidor: ${respuesta.status}`, 'error');
      mostrarToast('Error al enviar la factura.', 'error');
    }
  } catch (error) {
    actualizarEstadoEnvio(`❌ Error de conexión: ${error.message}`, 'error');
    mostrarToast('No se pudo conectar con el servidor.', 'error');
  } finally {
    elBtnGenerar.disabled = false;
  }
}

// ──────────────────────────────────────────────
// UTILIDADES
// ──────────────────────────────────────────────

/**
 * Formatea un número como moneda en euros (formato español).
 */
function formatearMoneda(valor) {
  return valor.toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Redondea un número a 2 decimales.
 */
function redondear(valor) {
  return Math.round(valor * 100) / 100;
}

/**
 * Actualiza el texto y la clase del estado de envío.
 */
function actualizarEstadoEnvio(mensaje, tipo) {
  elEstadoEnvio.textContent = mensaje;
  elEstadoEnvio.className = 'estado-envio';
  if (tipo) elEstadoEnvio.classList.add(tipo);
}

/**
 * Muestra un toast (notificación flotante) temporal.
 */
function mostrarToast(mensaje, tipo) {
  // Eliminar toast previo si existe
  const previo = document.querySelector('.toast');
  if (previo) previo.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;
  toast.textContent = mensaje;
  document.body.appendChild(toast);

  // Animar entrada
  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  // Eliminar tras 3 segundos
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ──────────────────────────────────────────────
// REGISTRO DE EVENTOS
// ──────────────────────────────────────────────

function registrarEventos() {
  // Selección de cliente
  elSelectorCliente.addEventListener('change', seleccionarCliente);

  // Nuevo cliente: mostrar/ocultar formulario
  elBtnToggleNuevoCliente.addEventListener('click', toggleNuevoCliente);

  // Nuevo cliente: guardar
  elBtnGuardarCliente.addEventListener('click', guardarNuevoCliente);

  // Nuevo cliente: cancelar
  elBtnCancelarCliente.addEventListener('click', () => {
    elNuevoClienteForm.hidden = true;
  });

  // Añadir línea de producto
  elBtnAñadirProducto.addEventListener('click', añadirLineaProducto);

  // Recalcular resumen cuando cambia el porte
  elPorteValor.addEventListener('input', recalcularResumen);

  // Generar factura
  elBtnGenerar.addEventListener('click', generarFactura);
}
