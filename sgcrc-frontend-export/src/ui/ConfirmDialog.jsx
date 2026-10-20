import Dialog from './Dialog.jsx'
import Button from './Button.jsx'

// Reemplaza window.confirm. El foco inicial cae en "Cancelar" (la acción segura).
export default function ConfirmDialog({
  abierto, titulo, children,
  textoConfirmar = 'Confirmar', textoCancelar = 'Cancelar',
  peligro = false, cargando = false, onConfirmar, onCancelar,
}) {
  return (
    <Dialog
      abierto={abierto}
      titulo={titulo}
      onCerrar={onCancelar}
      cerrable={!cargando}
      pie={(
        <>
          <Button variante="secundario" onClick={onCancelar} disabled={cargando} data-autofocus>{textoCancelar}</Button>
          <Button variante={peligro ? 'peligro' : 'primario'} onClick={onConfirmar} cargando={cargando}>{textoConfirmar}</Button>
        </>
      )}
    >
      {children}
    </Dialog>
  )
}
