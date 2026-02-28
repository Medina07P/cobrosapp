// src/views/Suscripciones.jsx
import { useState, useEffect } from 'react'
import { api } from '../api.js'
import { Modal, Input, Select, Btn, Badge, Spinner, ErrorMsg, fmt } from '../components.jsx'

const TIPOS = ['Membresía Básica','Membresía Pro','Membresía Premium','Servicio Mensual','Soporte Técnico','Licencia Software','Otro']

const EMPTY = { cliente_id:'', tipo:TIPOS[0], monto:'', dia_cobro:1, descripcion:'' }

export default function Suscripciones() {
  const [subs, setSubs]         = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [modal, setModal]       = useState(null)
  const [form, setForm]         = useState(EMPTY)
  const [saving, setSaving]     = useState(false)

  const cargar = async () => {
    setLoading(true); setError(null)
    try {
      const [s, c] = await Promise.all([api.getSuscripciones(), api.getClientes()])
      setSubs(s); setClientes(c)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const openNew  = () => { setForm(EMPTY); setModal('new') }
  const openEdit = (s) => { setForm({ ...s, monto: String(s.monto), cliente_id: String(s.cliente_id) }); setModal(s) }

  const guardar = async () => {
    if (!form.cliente_id || !form.monto || !form.tipo) return alert('Completa todos los campos requeridos')
    setSaving(true)
    try {
      const data = { ...form, cliente_id: Number(form.cliente_id), monto: Number(form.monto), dia_cobro: Number(form.dia_cobro) }
      if (modal === 'new') await api.createSuscripcion(data)
      else await api.updateSuscripcion(modal.id, data)
      setModal(null); cargar()
    } catch (e) { alert('Error: ' + e.message) }
    finally { setSaving(false) }
  }

  const toggleActiva = async (s) => {
    try { await api.updateSuscripcion(s.id, { activa: !s.activa }); cargar() }
    catch (e) { alert('Error: ' + e.message) }
  }

  if (loading) return <Spinner />

  return (
    <div>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem' }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif",color:'#e8eaf0',margin:0,fontSize:'1.8rem' }}>Suscripciones</h2>
        <Btn onClick={openNew}>+ Nueva Suscripción</Btn>
      </div>

      {error && <ErrorMsg msg={error} onRetry={cargar} />}

      <div style={{ background:'#0f1117',border:'1px solid #2a2d3a',borderRadius:'12px',overflow:'auto' }}>
        <table style={{ width:'100%',borderCollapse:'collapse',fontSize:'0.88rem' }}>
          <thead>
            <tr style={{ background:'#0a0c12',borderBottom:'1px solid #2a2d3a' }}>
              {['Cliente','Tipo','Monto','Día Cobro','Estado','Acciones'].map(h =>
                <th key={h} style={{ textAlign:'left',padding:'0.9rem 1rem',color:'#555',fontWeight:600,fontSize:'0.78rem',textTransform:'uppercase',whiteSpace:'nowrap' }}>{h}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {subs.length === 0
              ? <tr><td colSpan={6} style={{ padding:'2rem',textAlign:'center',color:'#444' }}>Sin suscripciones registradas</td></tr>
              : subs.map(s => {
                  const cl = clientes.find(c => c.id === s.cliente_id)
                  return (
                    <tr key={s.id} style={{ borderBottom:'1px solid #1a1d27',opacity:s.activa?1:0.5 }}>
                      <td style={{ padding:'0.85rem 1rem' }}>
                        <div style={{ color:'#e8eaf0',fontWeight:600 }}>{cl?.nombre || '—'}</div>
                        <div style={{ color:'#555',fontSize:'0.78rem' }}>{cl?.correo}</div>
                      </td>
                      <td style={{ padding:'0.85rem 1rem',color:'#8b8fa8' }}>{s.tipo}</td>
                      <td style={{ padding:'0.85rem 1rem',color:'#34d399',fontFamily:'monospace',fontWeight:700 }}>{fmt(s.monto)}</td>
                      <td style={{ padding:'0.85rem 1rem',color:'#a78bfa',fontWeight:700,textAlign:'center' }}>{s.dia_cobro}</td>
                      <td style={{ padding:'0.85rem 1rem' }}><Badge status={s.activa ? 'Activa' : 'Inactiva'} /></td>
                      <td style={{ padding:'0.85rem 1rem' }}>
                        <div style={{ display:'flex',gap:'0.4rem' }}>
                          <Btn variant='secondary' style={{ padding:'0.3rem 0.7rem',fontSize:'0.78rem' }} onClick={() => openEdit(s)}>Editar</Btn>
                          <Btn variant={s.activa?'danger':'secondary'} style={{ padding:'0.3rem 0.7rem',fontSize:'0.78rem' }} onClick={() => toggleActiva(s)}>
                            {s.activa ? 'Cancelar' : 'Activar'}
                          </Btn>
                        </div>
                      </td>
                    </tr>
                  )
                })
            }
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === 'new' ? 'Nueva Suscripción' : 'Editar Suscripción'} onClose={() => setModal(null)}>
          <Select label='Cliente' value={form.cliente_id} onChange={e => setForm(p => ({...p, cliente_id:e.target.value}))}>
            <option value=''>Seleccionar cliente...</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </Select>
          <Select label='Tipo de Suscripción' value={form.tipo} onChange={e => setForm(p => ({...p, tipo:e.target.value}))}>
            {TIPOS.map(t => <option key={t}>{t}</option>)}
          </Select>
          <Input label='Monto (COP)' type='number' value={form.monto} onChange={e => setForm(p => ({...p, monto:e.target.value}))} placeholder='250000' />
          <Input label='Día del mes de cobro (1-28)' type='number' min='1' max='28' value={form.dia_cobro} onChange={e => setForm(p => ({...p, dia_cobro:e.target.value}))} />
          <Input label='Descripción (opcional)' value={form.descripcion} onChange={e => setForm(p => ({...p, descripcion:e.target.value}))} placeholder='Notas adicionales...' />
          <div style={{ display:'flex',gap:'0.8rem',justifyContent:'flex-end',marginTop:'0.5rem' }}>
            <Btn variant='secondary' onClick={() => setModal(null)}>Cancelar</Btn>
            <Btn onClick={guardar} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
