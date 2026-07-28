const core = require('@actions/core');
const fs = require('fs');
const path = require('path');

const WORKSPACE = process.env.GITHUB_WORKSPACE || path.join(__dirname, '..');
const rubric = JSON.parse(fs.readFileSync(path.join(__dirname, 'rubric.json'), 'utf8'));

const { requiredFiles = [], requiredFolders = [], maxPoints = 20 } = rubric.structure;
const allChecks = [...requiredFiles, ...requiredFolders];
const pointsPerCheck = allChecks.length > 0 ? maxPoints / allChecks.length : 0;

let score = maxPoints;
const lines = [];

for (const item of requiredFiles) {
  const fullPath = path.join(WORKSPACE, item.path);
  const pts = item.points !== undefined ? item.points : pointsPerCheck;

  if (!fs.existsSync(fullPath)) {
    score -= pts;
    lines.push(`❌ **Falta archivo requerido:** \`${item.path}\`  \n   _${item.description}_`);
    continue;
  }

  const content = fs.readFileSync(fullPath, 'utf8').trim();
  if (content.length < 10) {
    score -= pts / 2;
    lines.push(`⚠️ **Archivo vacío o incompleto:** \`${item.path}\`  \n   _Tiene muy poco contenido — revisa que hayas guardado correctamente._`);
  } else {
    lines.push(`✅ \`${item.path}\` — presente y con contenido.`);
  }
}

for (const folder of requiredFolders) {
  const fullPath = path.join(WORKSPACE, folder.path);
  const pts = folder.points !== undefined ? folder.points : pointsPerCheck;

  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
    score -= pts;
    lines.push(`❌ **Falta carpeta requerida:** \`${folder.path}/\`  \n   _${folder.description}_`);
  } else {
    lines.push(`✅ \`${folder.path}/\` — encontrada.`);
  }
}

score = Math.max(0, Math.round(score));
core.setOutput('score', score.toString());
core.setOutput('feedback', lines.join('\n'));
console.log(`Estructura: ${score}/${maxPoints}`);
