/* =============================================================
   Pie de página institucional público.
   ============================================================= */
const FOOTER = {
  desarrolladora: 'Ingenio Digital',
  sistemaLogo: '/img/logo-sistema-transparente.png',
  sistemaNombre: 'Sistema de Asistencia DSJB',
  entidad: {
    etiqueta: 'Entidad aliada',
    nombre: 'Universidad Tecnológica del Chocó Diego Luis Córdoba',
    logo: '/img/logo-utch-transparente.png'
  },
  enlaces: [
    { nombre: 'Dairon',      red: 'linkedin', url: 'https://www.linkedin.com/in/daironorejuela/' },
    { nombre: 'Jean Pierre', red: 'linkedin', url: 'https://www.linkedin.com/in/jeanpier-buena%C3%B1o-742601437/' },
    { nombre: 'Facebook',    red: 'facebook', url: 'https://www.facebook.com/profile.php?id=61587633734785' }
  ]
};

function footerHTML(){
  const enlaces = FOOTER.enlaces.map(function(e){
    const icono = e.red === 'linkedin'
      ? '<span class="foo-ico foo-ico-in" aria-hidden="true">in</span>'
      : '<span class="foo-ico foo-ico-fb" aria-hidden="true">f</span>';
    const etiqueta = e.red === 'linkedin'
      ? 'Perfil de LinkedIn de ' + e.nombre + ' (abre en una pestaña nueva)'
      : 'Facebook de ' + FOOTER.desarrolladora + ' (abre en una pestaña nueva)';
    return '<a class="foo-chip" href="' + e.url + '" target="_blank" rel="noopener noreferrer" ' +
      'aria-label="' + etiqueta + '">' + icono + '<span>' + e.nombre + '</span></a>';
  }).join('');

  return '<div class="footer-top">' +
    '<div class="footer-zona foo-sistema">' +
      '<img src="' + FOOTER.sistemaLogo + '" alt="' + FOOTER.sistemaNombre + '">' +
    '</div>' +
    '<div class="footer-sep" aria-hidden="true"></div>' +
    '<div class="footer-zona foo-entidad">' +
      '<span class="foo-eyebrow">' + FOOTER.entidad.etiqueta + '</span>' +
      '<img src="' + FOOTER.entidad.logo + '" alt="' + FOOTER.entidad.nombre + '">' +
    '</div>' +
  '</div>' +
  '<div class="footer-devbar">' +
    '<div class="foo-dev-brand">' +
      '<img src="/ingenio.jpg" alt="Ingenio Digital">' +
      '<span>Desarrollado por <b>Ingenio Digital</b></span>' +
    '</div>' +
    '<nav class="foo-links" aria-label="Redes de ' + FOOTER.desarrolladora + '">' + enlaces + '</nav>' +
  '</div>' +
  '<p class="footer-copy"><span class="copy-full">© 2026 Sistema de Asistencia DSJB · Todos los derechos reservados</span><span class="copy-short">© 2026 Sistema de Asistencia DSJB</span></p>';
}

function montarFooter(selector){
  const el = document.querySelector(selector || '#site-footer');
  if(!el) return;
  el.innerHTML = footerHTML();
  el.hidden = false;
}

document.addEventListener('DOMContentLoaded', function(){
  const auto = document.querySelector('#site-footer[data-auto]');
  if(auto) montarFooter('#site-footer[data-auto]');
});