// Marcador de carga estático (sin pulso infinito). El texto oculto lo anuncia a lectores de pantalla.
export default function Skeleton({ filas = 3 }) {
  return (
    <div className="skeleton" role="status" aria-busy="true">
      <span className="sr-only">Cargando…</span>
      {Array.from({ length: filas }, (_, i) => <div key={i} className="skeleton-fila" aria-hidden="true" />)}
    </div>
  )
}
