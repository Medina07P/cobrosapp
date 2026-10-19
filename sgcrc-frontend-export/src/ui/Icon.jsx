import { ICONOS } from './icons.generated.js'

// Iconos Phosphor (regular) en SVG inline. Decorativo por defecto (aria-hidden);
// si el icono es el único contenido de un botón, pasar `label`.
export default function Icon({ name, size = 20, label, className, style }) {
  const interior = ICONOS[name]
  if (!interior) {
    if (import.meta.env.DEV) console.warn(`Icon: "${name}" no existe en icons.generated.js`)
    return null
  }
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={size}
      height={size}
      fill="currentColor"
      focusable="false"
      className={className}
      style={{ flexShrink: 0, ...style }}
      {...a11y}
      dangerouslySetInnerHTML={{ __html: interior }}
    />
  )
}
