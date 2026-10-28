// Rebotes permanentes: una dirección inexistente deja de recibir cobros hasta que se corrige.
// La comparación es estricta (sin trim ni minúsculas): la marca solo cuenta mientras
// `correo_rebotado` siga siendo exactamente el correo actual, así el bloqueo se levanta
// solo al cambiarlo.
//
// El frontend replica esta función (sgcrc-frontend-export/src/lib/rebotes.js) y una prueba
// de paridad las compara: si cambias una, cambia la otra.
function esReboteActivo(cliente) {
  return Boolean(cliente?.correo_rebotado) && cliente.correo_rebotado === cliente.correo;
}

module.exports = { esReboteActivo };
