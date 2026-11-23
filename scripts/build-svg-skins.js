'use strict';

const fs = require('fs');
const path = require('path');

const SKINS_ROOT = path.resolve(__dirname, '..', 'assets', 'skins');

function buildStarSlimeSvg(state) {
  const isSquished = state === 'poked';
  const isSweat = state === 'sweat';
  const isWorking = state === 'working';
  const isHappy = state === 'happy';

  const bodyTransform = isSquished
    ? 'translate(160 198) scale(1.12 0.86) translate(-160 -198)'
    : isSweat
      ? 'translate(160 185) rotate(-4) translate(-160 -185)'
      : isHappy
        ? 'translate(160 175) scale(1.03 1.03) translate(-160 -175)'
        : '';

  const blushOpacity = isSquished ? '0.9' : isHappy ? '0.78' : '0.48';

  let eyes = '';
  let mouth = '';
  let extras = '';

  if (state === 'idle') {
    eyes = `
      <ellipse cx="132" cy="176" rx="11.5" ry="14" fill="#1e1b4b"/>
      <ellipse cx="188" cy="176" rx="11.5" ry="14" fill="#1e1b4b"/>
      <circle cx="128" cy="171" r="4.5" fill="#fff"/>
      <circle cx="136" cy="181" r="2.2" fill="#93c5fd"/>
      <circle cx="184" cy="171" r="4.5" fill="#fff"/>
      <circle cx="192" cy="181" r="2.2" fill="#f9a8d4"/>
      <path d="M126 168 L128 172 L132 174 L128 176 L126 180 L124 176 L120 174 L124 172 Z" fill="#fde68a" opacity="0.85" transform="translate(8 4) scale(0.55)"/>
    `;
    mouth = `<path d="M150 192 Q155 198 160 193 Q165 198 170 192" fill="none" stroke="#312e81" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>`;
    extras = `
      <path d="M72 98 L76 110 L88 114 L76 118 L72 130 L68 118 L56 114 L68 110 Z" fill="#fef08a" stroke="#4338ca" stroke-width="2"/>
      <path d="M248 90 L251 98 L259 101 L251 104 L248 112 L245 104 L237 101 L245 98 Z" fill="#7dd3fc" stroke="#4338ca" stroke-width="1.8"/>
    `;
  } else if (isWorking) {
    eyes = `
      <ellipse cx="132" cy="174" rx="12" ry="13.5" fill="#1e1b4b"/>
      <ellipse cx="188" cy="174" rx="12" ry="13.5" fill="#1e1b4b"/>
      <path d="M120 158 L142 162" stroke="#312e81" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M200 158 L178 162" stroke="#312e81" stroke-width="3.4" stroke-linecap="round"/>
      <circle cx="128" cy="169" r="4.5" fill="#67e8f9"/>
      <circle cx="184" cy="169" r="4.5" fill="#f472b6"/>
      <circle cx="135" cy="179" r="2.3" fill="#fff"/>
      <circle cx="191" cy="179" r="2.3" fill="#fff"/>
    `;
    mouth = `<path d="M152 192 Q160 199 168 192" fill="none" stroke="#312e81" stroke-width="3.6" stroke-linecap="round"/>`;
    extras = `
      <g filter="url(#softGlow)">
        <path d="M160 226 L167 242 L183 249 L167 256 L160 272 L153 256 L137 249 L153 242 Z" fill="url(#holoStar)" stroke="#38bdf8" stroke-width="2.2"/>
        <circle cx="122" cy="242" r="4" fill="#67e8f9"/>
        <circle cx="198" cy="242" r="4" fill="#c084fc"/>
      </g>
      <path d="M62 118 L66 128 L76 132 L66 136 L62 146 L58 136 L48 132 L58 128 Z" fill="#67e8f9"/>
      <path d="M254 114 L258 124 L268 128 L258 132 L254 142 L250 132 L240 128 L250 124 Z" fill="#f472b6"/>
    `;
  } else if (isHappy) {
    eyes = `
      <path d="M119 177 Q132 161 145 177" fill="none" stroke="#1e1b4b" stroke-width="4.8" stroke-linecap="round"/>
      <path d="M175 177 Q188 161 201 177" fill="none" stroke="#1e1b4b" stroke-width="4.8" stroke-linecap="round"/>
    `;
    mouth = `<path d="M148 189 Q160 207 172 189 Z" fill="#fb7185" stroke="#312e81" stroke-width="3" stroke-linejoin="round"/>`;
    extras = `
      <path d="M66 90 L71 105 L86 110 L71 115 L66 130 L61 115 L46 110 L61 105 Z" fill="#fde047" stroke="#4338ca" stroke-width="2"/>
      <path d="M254 84 L259 99 L274 104 L259 109 L254 124 L249 109 L234 104 L249 99 Z" fill="#f472b6" stroke="#4338ca" stroke-width="2"/>
      <path d="M234 52 L237 61 L246 64 L237 67 L234 76 L231 67 L222 64 L231 61 Z" fill="#67e8f9"/>
      <path d="M88 58 L91 66 L99 69 L91 72 L88 80 L85 72 L77 69 L85 66 Z" fill="#c4b5fd"/>
    `;
  } else if (isSweat) {
    eyes = `
      <circle cx="132" cy="176" r="13" fill="#fff" stroke="#312e81" stroke-width="3.2"/>
      <circle cx="188" cy="176" r="13" fill="#fff" stroke="#312e81" stroke-width="3.2"/>
      <path d="M132 176 m-6 0 a6 6 0 1 0 12 0 a4 4 0 1 0 -8 0 a2 2 0 1 0 4 0" fill="none" stroke="#4338ca" stroke-width="2.5"/>
      <path d="M188 176 m-6 0 a6 6 0 1 0 12 0 a4 4 0 1 0 -8 0 a2 2 0 1 0 4 0" fill="none" stroke="#db2777" stroke-width="2.5"/>
    `;
    mouth = `<path d="M148 197 Q154 191 160 197 Q166 203 172 197" fill="none" stroke="#312e81" stroke-width="3.4" stroke-linecap="round"/>`;
    extras = `
      <path d="M226 118 C226 118 238 134 238 142 A12 12 0 0 1 214 142 C214 134 226 118 226 118 Z" fill="#38bdf8" stroke="#1e3a8a" stroke-width="2.4"/>
      <circle cx="222" cy="141" r="2.6" fill="#e0f2fe"/>
      <path d="M248 144 C248 144 256 155 256 160 A8 8 0 0 1 240 160 C240 155 248 144 248 144 Z" fill="#7dd3fc" stroke="#1e3a8a" stroke-width="2"/>
    `;
  } else if (isSquished) {
    eyes = `
      <path d="M122 170 L138 178 L122 186" fill="none" stroke="#1e1b4b" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M198 170 L182 178 L198 186" fill="none" stroke="#1e1b4b" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/>
    `;
    mouth = `<path d="M150 194 Q155 189 160 194 Q165 189 170 194" fill="none" stroke="#312e81" stroke-width="3.6" stroke-linecap="round"/>`;
    extras = `
      <path d="M232 104 L244 92 M244 104 L232 92" stroke="#f472b6" stroke-width="4" stroke-linecap="round"/>
      <path d="M74 114 L78 123 L87 127 L78 131 L74 140 L70 131 L61 127 L70 123 Z" fill="#f9a8d4"/>
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="320" height="320">
  <defs>
    <radialGradient id="slimeBody" cx="38%" cy="30%" r="72%">
      <stop offset="0%" stop-color="#e0f2fe"/>
      <stop offset="32%" stop-color="#7dd3fc"/>
      <stop offset="68%" stop-color="#a78bfa"/>
      <stop offset="100%" stop-color="#f472b6"/>
    </radialGradient>
    <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fde047"/>
      <stop offset="50%" stop-color="#c084fc"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    </linearGradient>
    <linearGradient id="holoStar" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e0f2fe"/>
      <stop offset="50%" stop-color="#67e8f9"/>
      <stop offset="100%" stop-color="#c084fc"/>
    </linearGradient>
    <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="3.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Back half of antigravity Saturn ring -->
  <ellipse cx="160" cy="186" rx="126" ry="34" transform="rotate(-14 160 186)" fill="none" stroke="url(#ringGrad)" stroke-width="7.5" stroke-dasharray="195 240" stroke-dashoffset="190" opacity="0.82"/>

  <g transform="${bodyTransform}">
    <!-- Plump kawaii 4-pointed star mochi silhouette -->
    <path d="M160 44
             C182 44, 198 110, 212 126
             C228 142, 276 154, 276 180
             C276 206, 228 218, 212 232
             C196 248, 184 282, 160 282
             C136 282, 124 248, 108 232
             C92 218, 44 206, 44 180
             C44 154, 92 142, 108 126
             C122 110, 138 44, 160 44 Z"
          fill="url(#slimeBody)" stroke="#2e2a66" stroke-width="5.5" stroke-linejoin="round"/>

    <!-- Glossy mochi specular highlights -->
    <ellipse cx="138" cy="112" rx="18" ry="10" transform="rotate(-24 138 112)" fill="#ffffff" opacity="0.62"/>
    <circle cx="116" cy="128" r="5" fill="#ffffff" opacity="0.58"/>

    <!-- Cute rosy cheeks -->
    <ellipse cx="112" cy="191" rx="13" ry="7.5" fill="#fb7185" opacity="${blushOpacity}"/>
    <ellipse cx="208" cy="191" rx="13" ry="7.5" fill="#fb7185" opacity="${blushOpacity}"/>

    <!-- Expressive chibi face -->
    ${eyes}
    ${mouth}
  </g>

  <!-- Front half of antigravity ring -->
  <ellipse cx="160" cy="186" rx="126" ry="34" transform="rotate(-14 160 186)" fill="none" stroke="url(#ringGrad)" stroke-width="8" stroke-linecap="round" stroke-dasharray="205 260" stroke-dashoffset="-15" filter="url(#softGlow)"/>

  <!-- State extras -->
  ${extras}
</svg>`;
}

function buildGoogleFourColorSvg(state) {
  const isSquished = state === 'poked';
  const isSweat = state === 'sweat';
  const isWorking = state === 'working';
  const isHappy = state === 'happy';

  const bigTransform = isSquished
    ? 'translate(148 188) scale(1.1 0.88) translate(-148 -188)'
    : isSweat
      ? 'translate(148 182) rotate(-5) translate(-148 -182)'
      : '';

  let bigFace = '';
  let twinFace = '';
  let extras = '';

  if (state === 'idle') {
    bigFace = `
      <ellipse cx="127" cy="176" rx="9" ry="11.5" fill="#172554"/>
      <ellipse cx="169" cy="176" rx="9" ry="11.5" fill="#172554"/>
      <circle cx="124" cy="172" r="3.6" fill="#fff"/>
      <circle cx="166" cy="172" r="3.6" fill="#fff"/>
      <path d="M141 190 Q148 197 155 190" fill="none" stroke="#1e3a8a" stroke-width="3.4" stroke-linecap="round"/>
    `;
    twinFace = `
      <circle cx="242" cy="116" r="3.2" fill="#172554"/>
      <circle cx="256" cy="116" r="3.2" fill="#172554"/>
      <path d="M245 123 Q249 127 253 123" fill="none" stroke="#1e3a8a" stroke-width="2.2" stroke-linecap="round"/>
    `;
  } else if (isWorking) {
    bigFace = `
      <ellipse cx="127" cy="175" rx="9.5" ry="11.5" fill="#172554"/>
      <ellipse cx="169" cy="175" rx="9.5" ry="11.5" fill="#172554"/>
      <path d="M117 161 L136 165" stroke="#1e3a8a" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M179 161 L160 165" stroke="#1e3a8a" stroke-width="3.2" stroke-linecap="round"/>
      <circle cx="124" cy="171" r="3.8" fill="#38bdf8"/>
      <circle cx="166" cy="171" r="3.8" fill="#facc15"/>
      <path d="M142 192 Q148 196 154 192" fill="none" stroke="#1e3a8a" stroke-width="3.2" stroke-linecap="round"/>
    `;
    twinFace = `
      <circle cx="242" cy="116" r="3.5" fill="#172554"/>
      <circle cx="256" cy="116" r="3.5" fill="#172554"/>
      <circle cx="241" cy="114.5" r="1.3" fill="#fff"/>
      <circle cx="255" cy="114.5" r="1.3" fill="#fff"/>
    `;
    extras = `
      <circle cx="148" cy="182" r="102" fill="none" stroke="#60a5fa" stroke-width="2.5" stroke-dasharray="12 10" opacity="0.72"/>
      <circle cx="62" cy="144" r="6" fill="#ea4335"/>
      <circle cx="232" cy="224" r="6" fill="#34a853"/>
      <circle cx="88" cy="242" r="5" fill="#fbbc05"/>
    `;
  } else if (isHappy) {
    bigFace = `
      <path d="M117 177 Q127 164 137 177" fill="none" stroke="#172554" stroke-width="4.2" stroke-linecap="round"/>
      <path d="M159 177 Q169 164 179 177" fill="none" stroke="#172554" stroke-width="4.2" stroke-linecap="round"/>
      <path d="M139 187 Q148 202 157 187 Z" fill="#fb7185" stroke="#1e3a8a" stroke-width="2.8"/>
    `;
    twinFace = `
      <path d="M238 117 Q242 112 246 117" fill="none" stroke="#172554" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M252 117 Q256 112 260 117" fill="none" stroke="#172554" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M245 123 Q249 128 253 123" fill="none" stroke="#1e3a8a" stroke-width="2.2" stroke-linecap="round"/>
    `;
    extras = `
      <path d="M68 88 L73 102 L87 107 L73 112 L68 126 L63 112 L49 107 L63 102 Z" fill="#fbbc05" stroke="#1e3a8a" stroke-width="2"/>
      <path d="M248 206 L252 216 L262 220 L252 224 L248 234 L244 224 L234 220 L244 216 Z" fill="#34a853" stroke="#1e3a8a" stroke-width="2"/>
      <path d="M78 232 L81 240 L89 243 L81 246 L78 254 L75 246 L67 243 L75 240 Z" fill="#ea4335"/>
    `;
  } else if (isSweat) {
    bigFace = `
      <circle cx="127" cy="176" r="10.5" fill="#fff" stroke="#1e3a8a" stroke-width="3"/>
      <circle cx="169" cy="176" r="10.5" fill="#fff" stroke="#1e3a8a" stroke-width="3"/>
      <circle cx="127" cy="176" r="3.5" fill="#172554"/>
      <circle cx="169" cy="176" r="3.5" fill="#172554"/>
      <path d="M138 195 Q143 190 148 195 Q153 200 158 195" fill="none" stroke="#1e3a8a" stroke-width="3.2" stroke-linecap="round"/>
    `;
    twinFace = `
      <circle cx="242" cy="116" r="3.6" fill="#fff" stroke="#1e3a8a" stroke-width="1.8"/>
      <circle cx="256" cy="116" r="3.6" fill="#fff" stroke="#1e3a8a" stroke-width="1.8"/>
      <circle cx="242" cy="116" r="1.4" fill="#172554"/>
      <circle cx="256" cy="116" r="1.4" fill="#172554"/>
    `;
    extras = `
      <path d="M204 128 C204 128 214 142 214 149 A10 10 0 0 1 194 149 C194 142 204 128 204 128 Z" fill="#38bdf8" stroke="#1e3a8a" stroke-width="2.2"/>
      <path d="M282 86 C282 86 289 96 289 101 A7 7 0 0 1 275 101 C275 96 282 86 282 86 Z" fill="#7dd3fc" stroke="#1e3a8a" stroke-width="1.8"/>
    `;
  } else {
    bigFace = `
      <path d="M119 170 L133 177 L119 184" fill="none" stroke="#172554" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M177 170 L163 177 L177 184" fill="none" stroke="#172554" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M140 193 Q144 189 148 193 Q152 189 156 193" fill="none" stroke="#1e3a8a" stroke-width="3.2" stroke-linecap="round"/>
    `;
    twinFace = `
      <path d="M238 113 L244 117 L238 121" fill="none" stroke="#172554" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M260 113 L254 117 L260 121" fill="none" stroke="#172554" stroke-width="2.4" stroke-linecap="round"/>
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="320" height="320">
  <defs>
    <linearGradient id="gFour" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4285f4"/>
      <stop offset="35%" stop-color="#34a853"/>
      <stop offset="68%" stop-color="#fbbc05"/>
      <stop offset="100%" stop-color="#ea4335"/>
    </linearGradient>
    <radialGradient id="whiteCore" cx="42%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="78%" stop-color="#eff6ff"/>
      <stop offset="100%" stop-color="#dbeafe"/>
    </radialGradient>
    <linearGradient id="twinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#60a5fa"/>
      <stop offset="50%" stop-color="#a78bfa"/>
      <stop offset="100%" stop-color="#f472b6"/>
    </linearGradient>
  </defs>

  <!-- Orbit halo connecting Gemini twins -->
  <ellipse cx="164" cy="170" rx="122" ry="44" transform="rotate(-22 164 170)" fill="none" stroke="url(#gFour)" stroke-width="5.5" opacity="0.72"/>

  <!-- Main 4-Color Gemini Star Spirit -->
  <g transform="${bigTransform}">
    <path d="M148 48
             C160 116, 178 134, 248 182
             C178 214, 160 232, 148 286
             C136 232, 118 214, 48 182
             C118 134, 136 116, 148 48 Z"
          fill="url(#gFour)" stroke="#1e293b" stroke-width="5.5" stroke-linejoin="round"/>
    <!-- Inner clean white-blue glossy face shield -->
    <circle cx="148" cy="180" r="52" fill="url(#whiteCore)" stroke="#3b82f6" stroke-width="3"/>
    <ellipse cx="113" cy="188" rx="9" ry="5.5" fill="#fb7185" opacity="${isSquished || isHappy ? '0.82' : '0.45'}"/>
    <ellipse cx="183" cy="188" rx="9" ry="5.5" fill="#fb7185" opacity="${isSquished || isHappy ? '0.82' : '0.45'}"/>
    ${bigFace}
  </g>

  <!-- Twin Companion Mini-Star (Gemini Twin!) -->
  <g transform="${isHappy ? 'translate(0 -8)' : ''}">
    <path d="M249 62
             C255 96, 263 104, 298 118
             C263 132, 255 140, 249 174
             C243 140, 235 132, 200 118
             C235 104, 243 96, 249 62 Z"
          fill="url(#twinGrad)" stroke="#1e293b" stroke-width="4.2" stroke-linejoin="round"/>
    <circle cx="249" cy="118" r="22" fill="#ffffff" opacity="0.92"/>
    ${twinFace}
  </g>

  ${extras}
</svg>`;
}

function main() {
  const states = ['idle', 'working', 'happy', 'sweat', 'poked'];
  const slimeDir = path.join(SKINS_ROOT, 'star-slime');
  const fourDir = path.join(SKINS_ROOT, 'google-fourcolor');
  fs.mkdirSync(slimeDir, { recursive: true });
  fs.mkdirSync(fourDir, { recursive: true });

  for (const st of states) {
    fs.writeFileSync(path.join(slimeDir, `${st}.svg`), buildStarSlimeSvg(st), 'utf8');
    fs.writeFileSync(path.join(fourDir, `${st}.svg`), buildGoogleFourColorSvg(st), 'utf8');
  }
  console.log('Generated 5-state SVG sprites for star-slime and google-fourcolor!');
}

main();
