// Genera assets/lenguajes-{dark,light}.svg con los lenguajes de TODOS mis repos
// (públicos y privados). La tarjeta "top-langs" de github-readme-stats solo ve los
// públicos, y casi todo mi código está en privados.
//
// Uso: node scripts/lenguajes.mjs   (necesita `gh` con sesión iniciada)
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_LENGUAJES = 6;
const MINIMO_PORCENTAJE = 1.5; // por debajo, va a "Otros"

const query = `query {
  viewer {
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
      nodes { languages(first: 20) { edges { size node { name color } } } }
    }
  }
}`;

const salida = execFileSync('gh', ['api', 'graphql', '-f', `query=${query}`], { encoding: 'utf8' });
const repos = JSON.parse(salida).data.viewer.repositories.nodes;

const bytes = new Map();
const colores = new Map();
for (const repo of repos) {
  for (const { size, node } of repo.languages.edges) {
    bytes.set(node.name, (bytes.get(node.name) ?? 0) + size);
    colores.set(node.name, node.color ?? '#8b949e');
  }
}

const total = [...bytes.values()].reduce((a, b) => a + b, 0);
const ordenados = [...bytes.entries()]
  .map(([nombre, b]) => ({ nombre, pct: (b / total) * 100, color: colores.get(nombre) }))
  .sort((a, b) => b.pct - a.pct);

const principales = ordenados
  .filter((l) => l.pct >= MINIMO_PORCENTAJE)
  .slice(0, MAX_LENGUAJES);
const restoPct = 100 - principales.reduce((a, l) => a + l.pct, 0);
const lenguajes = restoPct > 0.05
  ? [...principales, { nombre: 'Otros', pct: restoPct, color: '#8b949e' }]
  : principales;

const fecha = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

const temas = {
  dark: { fondo: '#0d1117', borde: '#30363d', titulo: '#14b8a6', texto: '#c9d1d9', suave: '#8b949e' },
  light: { fondo: '#ffffff', borde: '#d0d7de', titulo: '#0f766e', texto: '#1f2328', suave: '#57606a' },
};

const escapar = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function svg(t) {
  const ancho = 495;
  const x0 = 25;
  const anchoBarra = ancho - x0 * 2;
  const filas = Math.ceil(lenguajes.length / 2);
  const alto = 110 + filas * 26;

  let x = x0;
  const segmentos = lenguajes.map((l) => {
    const w = (l.pct / 100) * anchoBarra;
    const r = `<rect x="${x.toFixed(2)}" y="62" width="${w.toFixed(2)}" height="10" fill="${l.color}"/>`;
    x += w;
    return r;
  }).join('');

  const leyenda = lenguajes.map((l, i) => {
    const col = i % 2;
    const fila = Math.floor(i / 2);
    const lx = x0 + col * 225;
    const ly = 100 + fila * 26;
    return `<g transform="translate(${lx} ${ly})">`
      + `<circle cx="5" cy="-4" r="5" fill="${l.color}"/>`
      + `<text x="16" y="0" class="t">${escapar(l.nombre)}</text>`
      + `<text x="200" y="0" class="p" text-anchor="end">${l.pct.toFixed(1).replace('.', ',')} %</text>`
      + `</g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" role="img" aria-labelledby="titulo">
<title id="titulo">Lenguajes en mis repositorios públicos y privados</title>
<style>
  .h { font: 600 18px 'Segoe UI', Ubuntu, 'Helvetica Neue', sans-serif; fill: ${t.titulo}; }
  .s { font: 400 12px 'Segoe UI', Ubuntu, 'Helvetica Neue', sans-serif; fill: ${t.suave}; }
  .t { font: 400 13px 'Segoe UI', Ubuntu, 'Helvetica Neue', sans-serif; fill: ${t.texto}; }
  .p { font: 600 13px 'Segoe UI', Ubuntu, 'Helvetica Neue', sans-serif; fill: ${t.suave}; }
</style>
<rect x="0.5" y="0.5" width="${ancho - 1}" height="${alto - 1}" rx="6" fill="${t.fondo}" stroke="${t.borde}"/>
<text x="${x0}" y="34" class="h">Lenguajes que más uso</text>
<text x="${ancho - x0}" y="34" class="s" text-anchor="end">repos públicos y privados · ${fecha}</text>
<clipPath id="barra"><rect x="${x0}" y="62" width="${anchoBarra}" height="10" rx="5"/></clipPath>
<g clip-path="url(#barra)">${segmentos}</g>
${leyenda}
</svg>
`;
}

mkdirSync(join(raiz, 'assets'), { recursive: true });
for (const [nombre, tema] of Object.entries(temas)) {
  writeFileSync(join(raiz, 'assets', `lenguajes-${nombre}.svg`), svg(tema));
}
console.log(lenguajes.map((l) => `${l.nombre} ${l.pct.toFixed(1)} %`).join(' · '));
