// Marcador de carga estático (sin pulso infinito). El texto oculto lo anuncia a lectores de pantalla.
// El span va al final para no desplazar el nth-child de las filas.
export default function Skeleton({ filas = 3 }) {
  return (
    <div className="skeleton" role="status">
      {Array.from({ length: filas }, (_, i) => <div key={i} className="skeleton-fila" aria-hidden="true" />)}
      <span className="sr-only">Cargando…</span>
    </div>
  )
}
