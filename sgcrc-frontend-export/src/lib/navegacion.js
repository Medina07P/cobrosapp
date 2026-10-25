// Destinos de navegación y su reparto en móvil: la barra inferior lleva los de uso diario y
// "Más" agrupa el resto. Lógica pura para poder probarla sin DOM.

export const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'squares-four' },
  { id: 'clientes', label: 'Clientes', icon: 'users' },
  { id: 'planes', label: 'Planes', icon: 'tag' },
  { id: 'suscripciones', label: 'Suscripciones', icon: 'arrows-clockwise' },
  { id: 'historial', label: 'Historial', icon: 'clock-counter-clockwise' },
  { id: 'calendario', label: 'Calendario', icon: 'calendar-blank' },
  { id: 'configuracion', label: 'Configuración', icon: 'gear' },
]

export const IDS_BARRA_MOVIL = ['dashboard', 'clientes', 'suscripciones', 'calendario']

export const particionarNav = (nav = NAV) => ({
  barra: IDS_BARRA_MOVIL.map((id) => nav.find((n) => n.id === id)).filter(Boolean),
  mas: nav.filter((n) => !IDS_BARRA_MOVIL.includes(n.id)),
})

export const vistaEnMas = (view, nav = NAV) => particionarNav(nav).mas.some((n) => n.id === view)
