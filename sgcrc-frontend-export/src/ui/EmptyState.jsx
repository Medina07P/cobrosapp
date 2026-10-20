import Icon from './Icon.jsx'

export default function EmptyState({ icono = 'tag', titulo, nivel = 3, children, accion }) {
  const n = Number.isInteger(nivel) ? Math.min(6, Math.max(2, nivel)) : 3
  const Titulo = `h${n}`
  return (
    <div className="vacio">
      <Icon name={icono} size={36} />
      <Titulo className="vacio-titulo">{titulo}</Titulo>
      {children && <p className="vacio-texto">{children}</p>}
      {accion && <div className="vacio-accion">{accion}</div>}
    </div>
  )
}
