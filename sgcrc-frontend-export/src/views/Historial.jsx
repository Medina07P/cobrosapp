import { useState, useEffect } from 'react'
import { api } from '../api.js'
import { EstadoBadge } from '../ui/Badge.jsx'
import Skeleton from '../ui/Skeleton.jsx'
import ErrorMsg from '../ui/ErrorMsg.jsx'
import { mensajeError } from '../lib/errores.js'
import Button from '../ui/Button.jsx'
import PageHeader from '../ui/PageHeader.jsx'
import { fmt } from '../lib/formato.js'

const tarjeta = { background:'var(--surface)',border:'1px solid var(--line)',borderRadius:'8px' }
const numero = { fontVariantNumeric:'tabular-nums',fontWeight:700 }

export default function Historial() {
  const [historial, setHistorial] = useState([])
  const [clientes, setClientes]   = useState([])
  const [subs, setSubs]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [filtro, setFiltro]       = useState('todos')

  const cargar = async () => {
    setLoading(true); setError(null)
    try {
      const [h, c, s] = await Promise.all([api.getHistorial(), api.getClientes(), api.getSuscripciones()])
      setHistorial(h); setClientes(c); setSubs(s)
    } catch (e) { setError(mensajeError(e)) }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  if (loading) return <Skeleton />

  const enriquecido = historial.map(h => {
    const sus = subs.find(s => s.id === h.suscripcion_id)
    const cli = clientes.find(c => c.id === sus?.cliente_id)

    return {
      ...h,
      sus,
      cli,
      // CORRECCIÓN: Si h.monto no existe (registros viejos), usamos el de la suscripción
      monto_final: h.monto || sus?.monto || 0,
      // CORRECCIÓN: Buscamos 'fecha' (nuevo backend) o 'fecha_envio' (registros viejos)
      fecha_valida: h.fecha || h.fecha_envio
    }
  }).sort((a, b) => new Date(b.fecha_valida) - new Date(a.fecha_valida));

  const filtrados = filtro === 'todos' ? enriquecido : enriquecido.filter(h => h.estado === filtro)

  // CORRECCIÓN: Usamos monto_final para el cálculo del total
  const total   = enriquecido
    .filter(h => h.estado === 'Enviado')
    .reduce((a, h) => a + (Number(h.monto_final) || 0), 0)

  const fallidos = enriquecido.filter(h => h.estado === 'Fallido').length

  return (
    <div>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem',flexWrap:'wrap',gap:'1rem' }}>
        <PageHeader titulo="Historial de Envíos" />
        <div style={{ display:'flex',gap:'0.5rem',alignItems:'center',flexWrap:'wrap' }}>
          {['todos','Enviado','Fallido'].map(f => (
            <button key={f} type="button" onClick={() => setFiltro(f)} aria-pressed={filtro===f} style={{
              background: filtro===f ? 'var(--color-primario)' : 'var(--surface)',
              border: filtro===f ? '1px solid transparent' : '1px solid var(--line)',
              borderRadius:'6px',padding:'0.45rem 0.9rem',
              color: filtro===f ? 'var(--color-primario-contraste)' : 'var(--ink)',
              cursor:'pointer',fontSize:'0.85rem',fontWeight:600
            }}>{f === 'todos' ? 'Todos' : f}</button>
          ))}
          <Button variante="secundario" tam="sm" icono="arrow-clockwise" onClick={cargar}>Actualizar</Button>
        </div>
      </div>

      {error && <ErrorMsg msg={error} onRetry={cargar} />}

      <div style={{ display:'flex',gap:'1rem',marginBottom:'1.2rem',flexWrap:'wrap' }}>
        <div style={{ ...tarjeta,padding:'0.8rem 1.2rem',flex:1,minWidth:'160px' }}>
          <div style={{ ...numero,color:'var(--ok)',fontSize:'1.2rem' }}>{fmt(total)}</div>
          <div style={{ color:'var(--ink-2)',fontSize:'0.85rem' }}>Total cobrado (historial)</div>
        </div>
        <div style={{ ...tarjeta,padding:'0.8rem 1.2rem',flex:1,minWidth:'160px' }}>
          <div style={{ ...numero,color:'var(--bad)',fontSize:'1.2rem' }}>{fallidos}</div>
          <div style={{ color:'var(--ink-2)',fontSize:'0.85rem' }}>Envíos fallidos</div>
        </div>
        <div style={{ ...tarjeta,padding:'0.8rem 1.2rem',flex:1,minWidth:'160px' }}>
          <div style={{ ...numero,color:'var(--info)',fontSize:'1.2rem' }}>{enriquecido.length}</div>
          <div style={{ color:'var(--ink-2)',fontSize:'0.85rem' }}>Total registros</div>
        </div>
      </div>

      <div style={{ ...tarjeta,overflow:'auto' }}>
        <table style={{ width:'100%',borderCollapse:'collapse',fontSize:'0.9rem' }}>
          <thead>
            <tr style={{ background:'var(--surface-alt)',borderBottom:'1px solid var(--line)' }}>
              {['Fecha','Cliente','Suscripción','Monto','Estado'].map(h =>
                <th key={h} scope="col" style={{ textAlign:h==='Monto'?'right':'left',padding:'0.9rem 1rem',color:'var(--ink-2)',fontWeight:600,fontSize:'0.8rem',textTransform:'uppercase',letterSpacing:'0.04em' }}>{h}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0
              ? <tr><td colSpan={5} style={{ padding:'2rem',textAlign:'center',color:'var(--ink-2)' }}>Sin registros</td></tr>
              : filtrados.map(h => (
                  <tr key={h.id} style={{ borderBottom:'1px solid var(--line)' }}>
                    <td style={{ padding:'0.85rem 1rem',color:'var(--ink-2)',fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap',fontSize:'0.85rem' }}>
                      {/* CORRECCIÓN: Manejo de fecha con fallback */}
                      {h.fecha_valida
                        ? new Date(h.fecha_valida).toLocaleString('es-CO', { dateStyle:'short', timeStyle:'short' })
                        : '—'}
                    </td>
                    <td style={{ padding:'0.85rem 1rem',color:'var(--ink)' }}>{h.cli?.nombre || '—'}</td>
                    <td style={{ padding:'0.85rem 1rem',color:'var(--ink-2)' }}>{h.sus?.tipo || '—'}</td>
                    <td style={{ padding:'0.85rem 1rem',textAlign:'right',color:'var(--ink)',fontVariantNumeric:'tabular-nums' }}>
                      {/* CORRECCIÓN: Usamos monto_final */}
                      {fmt(h.monto_final)}
                    </td>
                    <td style={{ padding:'0.85rem 1rem' }}><EstadoBadge estado={h.estado} /></td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}
