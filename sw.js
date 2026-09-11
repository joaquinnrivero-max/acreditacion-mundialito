/**
 * SERVICE WORKER — Sistema de Acreditación Mundialito Senior Pilar 2026
 *
 * Guarda la página y el lector de códigos dentro del celular, para que
 * la acreditación abra aunque no haya internet.
 *
 * Ojo con una distinción importante: esto cachea la APLICACIÓN, no los datos.
 * La lista de inscriptos se guarda aparte (ver "base local" en index.html).
 * Las llamadas al Apps Script nunca se cachean: si hay conexión tienen que ir
 * a la planilla de verdad, porque es la única fuente confiable de quién ya
 * retiró la pulsera.
 *
 * IMPORTANTE: si algún día cambia el index.html, hay que subir el número de
 * versión de acá abajo. Si no, los celulares van a seguir usando la copia
 * vieja que tienen guardada y no se van a enterar del cambio.
 */

const VERSION = "v4";
const CACHE = "acreditacion-" + VERSION;

const ARCHIVOS = [
  "./",
  "./index.html",
  "./zxing-reader.js",
  "./zxing_reader.wasm"
];

// Al instalarse, se baja todo y lo guarda.
self.addEventListener("install", function(event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function(cache) { return cache.addAll(ARCHIVOS); })
      .then(function() { return self.skipWaiting(); })
  );
});

// Al activarse, borra las versiones viejas para no dejar basura acumulada.
self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys()
      .then(function(nombres) {
        return Promise.all(nombres.map(function(n) {
          if (n !== CACHE) return caches.delete(n);
        }));
      })
      .then(function() { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(event) {
  const url = event.request.url;

  // Todo lo que vaya al Apps Script pasa de largo: nunca se cachea ni se
  // responde con una copia guardada. Una respuesta vieja diciendo que
  // alguien no retiró la pulsera sería peor que no tener respuesta.
  if (url.indexOf("script.google.com") !== -1 ||
      url.indexOf("script.googleusercontent.com") !== -1) {
    return;
  }

  if (event.request.method !== "GET") return;

  // Para los archivos de la aplicación: primero la copia guardada (instantánea
  // y funciona sin señal), y en paralelo se actualiza para la próxima vez.
  event.respondWith(
    caches.match(event.request).then(function(guardado) {
      const desdeLaRed = fetch(event.request)
        .then(function(respuesta) {
          if (respuesta && respuesta.status === 200) {
            const copia = respuesta.clone();
            caches.open(CACHE).then(function(cache) {
              cache.put(event.request, copia);
            });
          }
          return respuesta;
        })
        .catch(function() { return guardado; });

      return guardado || desdeLaRed;
    })
  );
});
