// An original painted-landscape hero: big summer clouds, rolling hills, a lone tree and a
// little red-roofed house. Colours come from CSS variables so every theme and time of day
// can repaint it.

const SUN = { dawn: [70, 150, 20], day: [300, 46, 18], dusk: [330, 138, 22], night: [318, 44, 13] };

const cumulus = (x, y, s, cls = '') => `
  <g class="cloud ${cls}"><g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="34" rx="62" ry="15" class="cloud-shade"/>
    <circle cx="-34" cy="20" r="22"/><circle cx="-8" cy="4" r="30"/><circle cx="24" cy="-6" r="26"/>
    <circle cx="10" cy="-30" r="22"/><circle cx="44" cy="16" r="20"/><circle cx="-14" cy="-20" r="16"/>
    <ellipse cx="2" cy="28" rx="58" ry="12"/>
  </g></g>`;

const flowers = () => {
  let out = '';
  let seed = 7;
  const rand = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 46; i++) {
    const x = rand() * 400, y = 190 + rand() * 30;
    out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.9 + rand() * 1.3).toFixed(2)}" class="${i % 3 ? 'flower-a' : 'flower-b'}"/>`;
  }
  for (let i = 0; i < 30; i++) {
    const x = rand() * 400, y = 186 + rand() * 32;
    out += `<path d="M${x.toFixed(1)} ${y.toFixed(1)}q1.5 -5 3 -7" class="grass-blade"/>`;
  }
  return out;
};

const stars = () => {
  let out = '', seed = 3;
  const rand = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 40; i++) out += `<circle cx="${(rand() * 400).toFixed(1)}" cy="${(rand() * 110).toFixed(1)}" r="${(0.4 + rand() * 0.9).toFixed(2)}"/>`;
  return out;
};

const fireflies = () => [[60, 170], [120, 150], [205, 176], [262, 160], [340, 172], [372, 150], [168, 186]]
  .map(([x, y], i) => `<circle class="firefly" style="animation-delay:${(i * 0.7).toFixed(1)}s" cx="${x}" cy="${y}" r="1.6"/>`).join('');

let uid = 0;
export function scenery(time = 'day') {
  const u = `s${++uid}`;
  const [sx, sy, sr] = SUN[time] || SUN.day;
  const lit = time === 'dusk' || time === 'night';
  return `<svg class="scenery" data-time="${time}" viewBox="0 0 400 220" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="${u}-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color:var(--sky-a)"/><stop offset=".62" style="stop-color:var(--sky-b)"/><stop offset="1" style="stop-color:var(--sky-c)"/>
    </linearGradient>
    <radialGradient id="${u}-glow"><stop offset="0" style="stop-color:var(--sun);stop-opacity:.55"/><stop offset="1" style="stop-color:var(--sun);stop-opacity:0"/></radialGradient>
    <linearGradient id="${u}-hill-near" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--hill-near-a)"/><stop offset="1" style="stop-color:var(--hill-near-b)"/></linearGradient>
  </defs>
  <rect width="400" height="220" fill="url(#${u}-sky)"/>
  <g class="stars">${stars()}</g>
  <circle cx="${sx}" cy="${sy}" r="${sr * 3.2}" fill="url(#${u}-glow)"/>
  <circle class="sun" cx="${sx}" cy="${sy}" r="${sr}"/>
  ${time === 'night' ? `<circle cx="${sx + 6}" cy="${sy - 4}" r="${sr - 1}" class="moon-cut"/>` : ''}
  ${cumulus(250, 70, 1.25, 'cloud-big')}
  ${cumulus(70, 58, 0.62, 'cloud-small')}
  ${cumulus(372, 104, 0.5, 'cloud-small cloud-late')}
  <path class="ridge" d="M0 142 C40 120 70 128 104 116 C140 104 170 122 204 112 C240 102 262 120 300 108 C334 98 366 112 400 104 V220 H0Z"/>
  <path class="hill-far" d="M0 158 C60 136 120 150 170 140 C230 128 280 146 330 136 C360 130 384 136 400 134 V220 H0Z"/>
  <g class="tree" transform="translate(292 128)">
    <path d="M-1.6 0 L-2.4 26 H2.4 L1.6 0Z" class="trunk"/>
    <circle cx="0" cy="-4" r="13"/><circle cx="-10" cy="4" r="9"/><circle cx="10" cy="4" r="10"/><circle cx="2" cy="-14" r="9"/>
    <circle cx="-4" cy="-8" r="5" class="tree-light"/>
  </g>
  <path class="hill-mid" d="M0 176 C50 152 110 150 160 158 C200 164 230 150 280 150 C330 150 372 160 400 156 V220 H0Z"/>
  <g class="house" transform="translate(96 140)">
    <rect x="-1" y="-15" width="4" height="9" class="chimney"/>
    <path d="M-12 2 L0 -12 L14 -12 L24 2Z" class="roof"/>
    <rect x="-9" y="2" width="30" height="16" class="walls"/>
    <rect x="-4" y="6" width="6" height="6" class="window ${lit ? 'lit' : ''}"/>
    <rect x="9" y="7" width="6" height="11" class="door"/>
    <path class="smoke" d="M1 -17 c-3 -5 4 -7 0 -12 c-3 -4 3 -7 1 -11"/>
  </g>
  <path class="hill-near" d="M0 192 C70 170 150 176 210 186 C270 196 330 178 400 184 V220 H0Z" fill="url(#${u}-hill-near)"/>
  <path class="path" d="M128 220 C150 206 196 202 206 194 C214 188 200 182 178 179 C160 176 150 170 124 162 L118 163 C140 172 152 178 168 182 C184 186 194 190 186 196 C176 204 140 208 108 220Z"/>
  <g class="meadow">${flowers()}</g>
  <g class="fireflies">${fireflies()}</g>
</svg>`;
}
