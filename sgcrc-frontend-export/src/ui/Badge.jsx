import Icon from './Icon.jsx'

// El estado siempre lleva icono y texto, nunca solo color.
export default function Badge({ tono = 'warn', icono, children }) {
  return (
    <span className={`badge badge-${tono}`}>
      {icono && <Icon name={icono} size={14} />}
      {children}
    </span>
  )
}

const ESTADOS = {
  Enviado:  { tono: 'ok',  icono: 'check-circle' },
  Activa:   { tono: 'ok',  icono: 'check-circle' },
  Fallido:  { tono: 'bad', icono: 'x-circle' },
  Inactiva: { tono: 'bad', icono: 'x-circle' },
}
const ESTADO_PENDIENTE = { tono: 'warn', icono: 'clock-counter-clockwise' }

export function EstadoBadge({ estado }) {
  const e = ESTADOS[estado] || ESTADO_PENDIENTE
  return <Badge tono={e.tono} icono={e.icono}>{estado}</Badge>
}
