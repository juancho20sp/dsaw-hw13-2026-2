const core = require('@actions/core');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const WORKSPACE = process.env.GITHUB_WORKSPACE || path.join(__dirname, '..');
const rubric = JSON.parse(fs.readFileSync(path.join(__dirname, 'rubric.json'), 'utf8'));
const { maxPoints = 40, criteria = [], sourcePaths = [] } = rubric.acceptance;

const MAX_CHARS_PER_FILE = 4000;
const MAX_TOTAL_CHARS = 12000;

function readSourceFiles() {
  const parts = [];
  let totalChars = 0;

  const extensions = ['.html', '.css', '.js', '.jsx', '.ts', '.tsx', '.json', '.md'];

  let filesToRead = sourcePaths.length > 0 ? sourcePaths : [];

  if (filesToRead.length === 0) {
    const walk = (dir, depth = 0) => {
      if (depth > 3) return;
      try {
        for (const entry of fs.readdirSync(dir)) {
          if (entry.startsWith('.') || entry === 'node_modules' || entry === '.grading') continue;
          const full = path.join(dir, entry);
          const stat = fs.statSync(full);
          if (stat.isDirectory()) walk(full, depth + 1);
          else if (extensions.includes(path.extname(entry))) filesToRead.push(path.relative(WORKSPACE, full));
        }
      } catch { /* ignore */ }
    };
    walk(WORKSPACE);
  }

  for (const rel of filesToRead.slice(0, 10)) {
    if (totalChars >= MAX_TOTAL_CHARS) break;
    const full = path.join(WORKSPACE, rel);
    if (!fs.existsSync(full)) continue;
    try {
      let content = fs.readFileSync(full, 'utf8');
      if (content.length > MAX_CHARS_PER_FILE) {
        content = content.slice(0, MAX_CHARS_PER_FILE) + '\n... [truncado]';
      }
      parts.push(`--- ${rel} ---\n${content}`);
      totalChars += content.length;
    } catch { /* skip unreadable files */ }
  }

  return parts.join('\n\n');
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    core.setOutput('score', '0');
    core.setOutput('feedback', '⚠️ No se configuró `ANTHROPIC_API_KEY` en los secretos del repositorio. La evaluación de criterios de aceptación no pudo ejecutarse.');
    return;
  }

  const code = readSourceFiles();
  if (!code.trim()) {
    core.setOutput('score', '0');
    core.setOutput('feedback', '❌ No se encontraron archivos de código fuente para evaluar.');
    return;
  }

  const criteriaText = criteria.map((c, i) => `${i + 1}. ${c}`).join('\n');

  const prompt = `Eres un profesor universitario evaluando una tarea de desarrollo web.

TAREA: ${rubric.name}

CRITERIOS DE ACEPTACIÓN (${maxPoints} puntos en total):
${criteriaText}

CÓDIGO DEL ESTUDIANTE:
${code}

Evalúa qué tan bien cumple el estudiante cada criterio. Sé estricto pero justo.
Asigna un puntaje total de 0 a ${maxPoints} puntos.

Responde ÚNICAMENTE en formato JSON sin texto adicional:
{
  "score": <número entre 0 y ${maxPoints}>,
  "feedback": "<retroalimentación detallada en español, máximo 400 palabras, con bullet points por criterio usando ✅ para cumplido, ⚠️ para parcialmente cumplido, ❌ para no cumplido>"
}`;

  const client = new Anthropic();

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0].text.trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Respuesta inesperada del modelo: ${raw.slice(0, 200)}`);

  const parsed = JSON.parse(jsonMatch[0]);
  const score = Math.max(0, Math.min(maxPoints, Math.round(parsed.score)));

  core.setOutput('score', score.toString());
  core.setOutput('feedback', parsed.feedback || '_Sin retroalimentación._');
  console.log(`Criterios: ${score}/${maxPoints}`);
}

main().catch((err) => {
  console.error(err);
  core.setOutput('score', '0');
  core.setOutput('feedback', `❌ Error en la evaluación de criterios: ${err.message}`);
});
