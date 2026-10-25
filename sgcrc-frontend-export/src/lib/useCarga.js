import { useCallback, useEffect, useReducer, useRef } from 'react'
import { estadoInicial, reducirCarga } from './carga.js'
import { mensajeError } from './errores.js'
import { toast } from '../ui/Toast.jsx'

// Patrón de carga de las vistas: Skeleton hasta la primera carga correcta, ErrorMsg si esa falla,
// y, con datos previos, un fallo de recarga avisa sin perder la lista.
export function useCarga(cargador, { avisoConDatos = 'toast' } = {}) {
  const [estado, dispatch] = useReducer(reducirCarga, estadoInicial)
  const montado = useRef(true)
  const enCurso = useRef(false)
  const pendiente = useRef(false)
  const hayDatos = useRef(false)
  const cargadorRef = useRef(cargador)
  cargadorRef.current = cargador

  const cargar = useCallback(async ({ enfocar = false } = {}) => {
    if (enCurso.current) { pendiente.current = true; return false }
    enCurso.current = true
    dispatch({ tipo: 'inicio' })
    let ok = false
    try {
      const datos = await cargadorRef.current()
      if (!montado.current) return false
      hayDatos.current = true
      dispatch({ tipo: 'exito', datos })
      ok = true
      // El botón "Reintentar" ya no existe: el foco pasa al título de la vista.
      if (enfocar) requestAnimationFrame(() => document.querySelector('#contenido h1')?.focus({ preventScroll: true }))
    } catch (e) {
      if (!montado.current) return false
      const mensaje = mensajeError(e)
      if (hayDatos.current && avisoConDatos === 'toast') {
        toast.error(mensaje)
        dispatch({ tipo: 'fin' })
      } else {
        dispatch({ tipo: 'fallo', mensaje })
      }
    } finally {
      enCurso.current = false
      if (pendiente.current && montado.current) {
        pendiente.current = false
        cargar()
      }
    }
    return ok
  }, [avisoConDatos])

  useEffect(() => {
    montado.current = true
    cargar()
    return () => { montado.current = false }
  }, [cargar])

  const reintentar = useCallback(() => cargar({ enfocar: true }), [cargar])
  const setDatos = useCallback((datos) => dispatch({ tipo: 'poner', datos }), [])

  return { ...estado, hayDatos: estado.datos !== null, cargar, reintentar, setDatos }
}
