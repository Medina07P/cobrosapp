import { useId } from 'react'
import Icon from './Icon.jsx'

// Campo de formulario con label visible asociado, ayuda y error en línea.
// `as` elige el control: 'input' (por defecto), 'select' o 'textarea'; los children pasan al control.
export default function Field({ label, ayuda, error, requerido = false, as: Control = 'input', id, className = '', 'aria-describedby': describedbyExtra, ...resto }) {
  const autoId = useId()
  const idCampo = id || autoId
  const idAyuda = ayuda ? `${idCampo}-ayuda` : null
  const idError = error ? `${idCampo}-error` : null
  const descrito = [describedbyExtra, idAyuda, idError].filter(Boolean).join(' ') || undefined

  return (
    <div className="field">
      <label className="field-label" htmlFor={idCampo}>
        {label}
        {requerido && <span className="field-requerido" aria-hidden="true"> *</span>}
      </label>
      <Control
        id={idCampo}
        className={`field-control ${className}`.trim()}
        aria-describedby={descrito}
        aria-invalid={error ? true : undefined}
        aria-required={requerido || undefined}
        {...resto}
      />
      {ayuda && <p id={idAyuda} className="field-ayuda">{ayuda}</p>}
      {error && (
        <p id={idError} className="field-error">
          <Icon name="warning-circle" size={14} />
          {error}
        </p>
      )}
    </div>
  )
}
