import { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function Configuracion() {
  const [usuario, setUsuario] = useState({ nombre: '', color_tema: '#4f46e5' });
  const [status, setStatus] = useState('');

  // Cargar datos actuales del usuario
  useEffect(() => {
    const cargar = async () => {
      const data = await api.getPerfil(); // Asegúrate de tener este método en api.js
      setUsuario(data);
    };
    cargar();
  }, []);

  const guardar = async () => {
    try {
      await api.updatePerfil(usuario); // Asegúrate de tener este método en api.js
      setStatus('✅ Configuración guardada. Recarga para ver los cambios.');
      
      // Actualizamos la variable de CSS en tiempo real para previsualizar
      document.documentElement.style.setProperty('--color-primario', usuario.color_tema);
    } catch (e) {
      setStatus('❌ Error al guardar');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
      <h2 className="text-2xl font-bold text-slate-800">Configuración de Marca</h2>
      
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nombre de la Empresa / Vendedor</label>
          <input 
            className="w-full border rounded-xl px-4 py-3 focus:border-brand outline-none"
            value={usuario.nombre}
            onChange={e => setUsuario({...usuario, nombre: e.target.value})}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Color de Identidad (Emails y Dashboard)</label>
          <div className="flex items-center gap-4">
            <input 
              type="color" 
              className="w-20 h-20 rounded-lg cursor-pointer border-4 border-slate-50"
              value={usuario.color_tema}
              onChange={e => setUsuario({...usuario, color_tema: e.target.value})}
            />
            <div className="flex-1">
              <p className="text-sm font-mono text-slate-600 uppercase">{usuario.color_tema}</p>
              <p className="text-xs text-slate-400">Este color se usará en los botones de tus correos y en la interfaz.</p>
            </div>
          </div>
        </div>

        {status && <p className="text-sm font-medium text-emerald-600">{status}</p>}

        <button 
          onClick={guardar}
          className="w-full bg-brand text-white font-bold py-4 rounded-xl shadow-lg hover-brand transition-all"
        >
          Guardar Cambios
        </button>
      </div>
      
      {/* Previsualización rápida */}
      <div className="p-6 border-2 border-dashed border-slate-200 rounded-3xl text-center">
        <p className="text-xs text-slate-400 uppercase font-bold mb-4 tracking-widest">Previsualización de Botón de Correo</p>
        <button style={{backgroundColor: usuario.color_tema}} className="text-white px-8 py-3 rounded-lg font-bold shadow-md">
          Reportar Pago por WhatsApp
        </button>
      </div>
    </div>
  );
}