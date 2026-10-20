// Encabezado de página: el único h1 de cada vista.
export default function PageHeader({ titulo, descripcion, acciones }) {
  return (
    <div className="pagina-cab">
      <div>
        <h1 className="pagina-titulo" tabIndex={-1}>{titulo}</h1>
        {descripcion && <p className="pagina-desc">{descripcion}</p>}
      </div>
      {acciones && <div className="pagina-acciones">{acciones}</div>}
    </div>
  )
}
