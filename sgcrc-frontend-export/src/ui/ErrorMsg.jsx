import Icon from './Icon.jsx'
import Button from './Button.jsx'

export default function ErrorMsg({ msg, onRetry, cargando = false }) {
  return (
    <div role="alert" className="aviso-error">
      <span className="aviso-error-texto">
        <Icon name="warning" size={18} />
        {msg}
      </span>
      {onRetry && <Button variante="peligro" cargando={cargando} onClick={onRetry}>Reintentar</Button>}
    </div>
  )
}
