import Icon from './Icon.jsx'

export default function EmptyState({ icono = 'tag', titulo, children, accion }) {
  return (
    <div className="vacio">
      <Icon name={icono} size={36} />
      <h3 className="vacio-titulo">{titulo}</h3>
      {children && <p className="vacio-texto">{children}</p>}
      {accion && <div className="vacio-accion">{accion}</div>}
    </div>
  )
}
