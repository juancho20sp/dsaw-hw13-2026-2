const core = require('@actions/core');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const WORKSPACE = process.env.GITHUB_WORKSPACE || path.join(__dirname, '..');
const rubric = JSON.parse(fs.readFileSync(path.join(__dirname, 'rubric.json'), 'utf8'));
const { type = 'github-pages', maxPoints = 20 } = rubric.deployment;

function fetchUrl(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: 10000 }, (res) => {
      resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 400 });
    });
    req.on('error', () => resolve({ status: 0, ok: false }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 408, ok: false }); });
  });
}

function resolveGithubPagesUrl() {
  const repo = process.env.GITHUB_REPOSITORY || '';
  const [owner, repoName] = repo.split('/');
  if (!owner || !repoName) return null;
  return `https://${owner}.github.io/${repoName}/`;
}

function resolveVercelUrl() {
  const deployFile = path.join(WORKSPACE, 'deployment.txt');
  if (!fs.existsSync(deployFile)) return null;
  const url = fs.readFileSync(deployFile, 'utf8').trim();
  return url.startsWith('http') ? url : null;
}

async function main() {
  let url = null;
  let lines = [];
  let score = maxPoints;

  if (type === 'github-pages') {
    url = resolveGithubPagesUrl();
    if (!url) {
      core.setOutput('score', '0');
      core.setOutput('feedback', '❌ No se pudo determinar la URL de GitHub Pages. Verifica que el repositorio tiene Pages habilitado.');
      return;
    }
    lines.push(`🔗 URL verificada: \`${url}\``);
  } else if (type === 'vercel') {
    url = resolveVercelUrl();
    if (!url) {
      core.setOutput('score', '0');
      core.setOutput('feedback', '❌ No se encontró `deployment.txt` con la URL de Vercel. Crea el archivo con tu URL de despliegue en la raíz del repositorio.\n\nEjemplo: `https://mi-proyecto.vercel.app`');
      return;
    }
    lines.push(`🔗 URL de Vercel: \`${url}\``);
  }

  const result = await fetchUrl(url);

  if (result.ok) {
    lines.push(`✅ **Despliegue verificado** — el sitio responde con HTTP ${result.status}.`);
  } else if (result.status === 0) {
    score -= maxPoints;
    lines.push(`❌ **Sin respuesta** — no se pudo conectar a \`${url}\`. ¿Está desplegado y público?`);
  } else if (result.status === 404) {
    score = Math.round(maxPoints * 0.2);
    lines.push(`⚠️ **HTTP 404** — el sitio existe pero devuelve "Not Found". Revisa que el archivo \`index.html\` esté en la raíz del repositorio.`);
  } else {
    score = Math.round(maxPoints * 0.3);
    lines.push(`⚠️ **HTTP ${result.status}** — el sitio responde pero con un error. Verifica la configuración del despliegue.`);
  }

  score = Math.max(0, score);
  core.setOutput('score', score.toString());
  core.setOutput('feedback', lines.join('\n'));
  console.log(`Despliegue: ${score}/${maxPoints} — ${url}`);
}

main().catch((err) => {
  core.setOutput('score', '0');
  core.setOutput('feedback', `❌ Error verificando despliegue: ${err.message}`);
});
