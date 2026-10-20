import Icon from './Icon.jsx'

// variante: 'primario' | 'secundario' | 'peligro'. tam: 'md' | 'sm'.
// cargando: usa aria-disabled (no `disabled` nativo, para conservar el foco), anuncia aria-busy,
// ignora el clic y gira el icono. `disabled` explícito sigue siendo nativo.
export default function Button({
  variante = 'primario', tam = 'md', icono, cargando = false,
  type = 'button', className = '', disabled, onClick, children, ...resto
}) {
  const clases = ['btn', `btn-${variante}`, tam === 'sm' ? 'btn-sm' : '', className].filter(Boolean).join(' ')
  const alClic = (e) => {
    if (cargando) { e.preventDefault(); return }
    onClick?.(e)
  }
  return (
    <button
      type={type} className={clases} disabled={disabled}
      aria-disabled={cargando || undefined} aria-busy={cargando || undefined}
      onClick={alClic} {...resto}
    >
      {cargando
        ? <Icon name="arrow-clockwise" size={18} className="btn-girando" />
        : icono && <Icon name={icono} size={18} />}
      {children}
    </button>
  )
}
