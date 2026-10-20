import Icon from './Icon.jsx'
import Button from './Button.jsx'

export default function ErrorMsg({ msg, onRetry }) {
  return (
    <div role="alert" className="aviso-error">
      <span className="aviso-error-texto">
        <Icon name="warning" size={18} />
        {msg}
      </span>
      {onRetry && <Button variante="peligro" onClick={onRetry}>Reintentar</Button>}
    </div>
  )
}
