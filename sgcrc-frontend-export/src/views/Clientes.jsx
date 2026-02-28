// src/views/Clientes.jsx
import { useState, useEffect } from 'react'
import { api } from '../api.js'
import { Modal, Input, Btn, Spinner, ErrorMsg } from '../components.jsx'

export default function Clientes() {
  const [clientes, setClientes]   = useState([])
  const [subs, setSubs]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [modal, setModal]         = useState(null)
  const [form, setForm]           = useState({ nombre:'', correo:'' })
  const [saving, setSaving]       = useState(false)

  const cargar = async () => {
    setLoading(true); setError(null)
    try {
      const [c, s] = await Promise.all([api.getClientes(), api.getSuscripciones()])
      setClientes(c); setSubs(s)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const openNew  = () => { setForm({ nombre:'', correo:'' }); setModal('new') }
  const openEdit = (c) => { setForm({ nombre:c.nombre, correo:c.correo }); setModal(c) }

  const guardar = async () => {
    if (!form.nombre.trim() || !form.correo.trim()) return alert('Nombre y correo son requeridos')
    setSaving(true)
    try {
      if (modal === 'new') await api.createCliente(form)
      else await api.updateCliente(modal.id, form)
      setModal(null)
      cargar()
    } catch (e) { alert('Error: ' + e.message) }
    finally { setSaving(false) }
  }

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar cliente? También se desactivarán sus suscripciones.')) return
    try { await api.deleteCliente(id); cargar() }
    catch (e) { alert('Error: ' + e.message) }
  }

  if (loading) return <Spinner />

  return (
    <div>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem' }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif",color:'#e8eaf0',margin:0,fontSize:'1.8rem' }}>Clientes</h2>
        <Btn onClick={openNew}>+ Nuevo Cliente</Btn>
      </div>

      {error && <ErrorMsg msg={error} onRetry={cargar} />}

      <div style={{ background:'#0f1117',border:'1px solid #2a2d3a',borderRadius:'12px',overflow:'auto' }}>
        <table style={{ width:'100%',borderCollapse:'collapse',fontSize:'0.9rem' }}>
          <thead>
            <tr style={{ background:'#0a0c12',borderBottom:'1px solid #2a2d3a' }}>
              {['Nombre','Correo','Suscripciones','Acciones'].map(h =>
                <th key={h} style={{ textAlign:'left',padding:'0.9rem 1rem',color:'#555',fontWeight:600,fontSize:'0.78rem',letterSpacing:'0.05em',textTransform:'uppercase' }}>{h}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {clientes.length === 0
              ? <tr><td colSpan={4} style={{ padding:'2rem',textAlign:'center',color:'#444' }}>Sin clientes registrados</td></tr>
              : clientes.map(c => {
                  const nsus = subs.filter(s => s.cliente_id === c.id && s.activa).length
                  return (
                    <tr key={c.id} style={{ borderBottom:'1px solid #1a1d27' }}>
                      <td style={{ padding:'0.9rem 1rem',color:'#e8eaf0',fontWeight:600 }}>{c.nombre}</td>
                      <td style={{ padding:'0.9rem 1rem',color:'#8b8fa8' }}>{c.correo}</td>
                      <td style={{ padding:'0.9rem 1rem' }}>
                        <span style={{ background:'#1e1830',color:'#a78bfa',borderRadius:'20px',padding:'0.2rem 0.7rem',fontSize:'0.8rem' }}>
                          {nsus} activa{nsus !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td style={{ padding:'0.9rem 1rem' }}>
                        <div style={{ display:'flex',gap:'0.5rem' }}>
                          <Btn variant='secondary' style={{ padding:'0.35rem 0.8rem',fontSize:'0.8rem' }} onClick={() => openEdit(c)}>Editar</Btn>
                          <Btn variant='danger'    style={{ padding:'0.35rem 0.8rem',fontSize:'0.8rem' }} onClick={() => eliminar(c.id)}>Eliminar</Btn>
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
        <Modal title={modal === 'new' ? 'Nuevo Cliente' : 'Editar Cliente'} onClose={() => setModal(null)}>
          <Input label='Nombre completo / Empresa' value={form.nombre} onChange={e => setForm(p => ({...p, nombre:e.target.value}))} placeholder='Ej: Empresa Alfa SAS' />
          <Input label='Correo electrónico' type='email' value={form.correo} onChange={e => setForm(p => ({...p, correo:e.target.value}))} placeholder='correo@empresa.com' />
          <div style={{ display:'flex',gap:'0.8rem',justifyContent:'flex-end',marginTop:'0.5rem' }}>
            <Btn variant='secondary' onClick={() => setModal(null)}>Cancelar</Btn>
            <Btn onClick={guardar} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
