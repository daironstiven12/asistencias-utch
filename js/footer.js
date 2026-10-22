/* =============================================================
   Pie de página institucional público.
   Solo presentación: no contiene lógica de negocio ni toca datos.
   Los datos editables viven en un único objeto: FOOTER.
   ============================================================= */
const FOOTER = {
  desarrolladora: 'Ingenio Digital',
  sistemaLogo: '/img/logo-v2.png',
  sistemaNombre: 'Sistema de Asistencia DSJB',
  entidad: {
    etiqueta: 'Entidad aliada',
    nombre: 'Universidad Tecnológica del Chocó Diego Luis Córdoba',
    logo: '/logo.png'
  },
  enlaces: [
    { nombre: 'Dairon',      red: 'linkedin', url: 'https://www.linkedin.com/in/daironorejuela/' },
    { nombre: 'Jean Pierre', red: 'linkedin', url: 'https://www.linkedin.com/in/jeanpier-buena%C3%B1o-742601437/' },
    { nombre: 'Facebook',    red: 'facebook', url: 'https://www.facebook.com/profile.php?id=61587633734785' }
  ]
};

const FOOTER_ICONOS = {
  linkedin:
    '<svg class="ico-linkedin" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">' +
      '<rect width="24" height="24" rx="5" fill="#0a66c2"/>' +
      '<path fill="#fff" d="M6.94 8.5H4.5V19.5h2.44V8.5zM5.72 4.5a1.42 1.42 0 1 0 0 2.84 1.42 1.42 0 0 0 0-2.84zM19.5 13.37c0-2.9-1.55-4.25-3.62-4.25-1.67 0-2.42.92-2.84 1.57V8.5h-2.44V19.5h2.44v-6.15c0-1.62.31-3.19 2.32-3.19 1.98 0 2.01 1.85 2.01 3.29v6.05h2.44v-6.13z"/>' +
    '</svg>',
  facebook:
    '<svg class="ico-facebook" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">' +
      '<circle cx="12" cy="12" r="12" fill="#1877f2"/>' +
      '<path fill="#fff" d="M15.6 12.6h-2.4V20h-2.9v-7.4H8.5V10h1.8V8.1c0-2.05 1.05-3.3 3.3-3.3h2.3v2.55h-1.4c-.75 0-.9.35-.9.9V10h2.4l-.4 2.6z"/>' +
    '</svg>'
};

function footerHTML(){
  const enlaces = FOOTER.enlaces.map(function(e){
    const icono = FOOTER_ICONOS[e.red] || '';
    const etiqueta = e.red === 'linkedin'
      ? 'Perfil de LinkedIn de ' + e.nombre + ' (abre en una pestaña nueva)'
      : 'Facebook de ' + FOOTER.desarrolladora + ' (abre en una pestaña nueva)';
    return '<a class="foo-link" href="' + e.url + '" target="_blank" rel="noopener noreferrer" ' +
      'aria-label="' + etiqueta + '">' + icono + '<span>' + e.nombre + '</span></a>';
  }).join('');

  return '<div class="footer-grid">' +
    '<div class="footer-zona foo-sistema">' +
      '<img src="' + FOOTER.sistemaLogo + '" alt="' + FOOTER.sistemaNombre + '">' +
    '</div>' +
    '<div class="footer-zona foo-entidad">' +
      '<span class="foo-eyebrow">' + FOOTER.entidad.etiqueta + '</span>' +
      '<img src="' + FOOTER.entidad.logo + '" alt="' + FOOTER.entidad.nombre + '">' +
    '</div>' +
    '<div class="footer-zona foo-dev">' +
      '<p class="foo-dev-txt">Desarrollado por <b>' + FOOTER.desarrolladora + '</b></p>' +
      '<nav class="foo-links" aria-label="Redes de ' + FOOTER.desarrolladora + '">' + enlaces + '</nav>' +
    '</div>' +
  '</div>';
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
