import Icon from './Icon.jsx'

// variante: 'primario' | 'secundario' | 'peligro'. tam: 'md' | 'sm'.
// cargando: deshabilita el botón, anuncia aria-busy y gira el icono.
export default function Button({
  variante = 'primario', tam = 'md', icono, cargando = false,
  type = 'button', className = '', disabled, children, ...resto
}) {
  const clases = ['btn', `btn-${variante}`, tam === 'sm' ? 'btn-sm' : '', className].filter(Boolean).join(' ')
  return (
    <button type={type} className={clases} disabled={disabled || cargando} aria-busy={cargando || undefined} {...resto}>
      {cargando
        ? <Icon name="arrow-clockwise" size={18} className="btn-girando" />
        : icono && <Icon name={icono} size={18} />}
      {children}
    </button>
  )
}
