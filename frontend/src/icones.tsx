const base = {
  width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
}

export const Icone = {
  oportunidades: <svg {...base}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" /><path d="M3 12.5h18" /><path d="M11 12.5v1.5h2v-1.5" /></svg>,
  contatos: <svg {...base}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4" /><path d="M18.5 14.8c1.7.7 2.7 2.4 3 5.2" /></svg>,
  radar: <svg {...base}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><path d="M12 12l5.5-5.5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>,
  match: <svg {...base}><circle cx="9" cy="12" r="5.5" /><circle cx="15" cy="12" r="5.5" /></svg>,
  deals: <svg {...base}><path d="M4 12l5 5L20 6" /></svg>,
  sair: <svg {...base} width={18} height={18}><path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" /><path d="M10 8l-4 4 4 4" /><path d="M6 12h10" /></svg>,
  painel: <svg {...base} width={18} height={18}><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M9 4v16" /></svg>,
  busca: <svg {...base} width={16} height={16}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>,
  mais: <svg {...base} width={16} height={16} strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg>,
  fechar: <svg {...base} width={16} height={16}><path d="M6 6l12 12M18 6L6 18" /></svg>,
}
