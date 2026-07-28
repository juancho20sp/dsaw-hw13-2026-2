const core = require('@actions/core');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE = process.env.GITHUB_WORKSPACE || path.join(__dirname, '..');
const rubric = JSON.parse(fs.readFileSync(path.join(__dirname, 'rubric.json'), 'utf8'));
const { checks = [], maxPoints = 20 } = rubric.quality;

let score = maxPoints;
const lines = [];

function run(cmd, opts = {}) {
  try {
    return { stdout: execSync(cmd, { cwd: WORKSPACE, encoding: 'utf8', ...opts }), code: 0 };
  } catch (e) {
    return { stdout: e.stdout || '', stderr: e.stderr || '', code: e.status || 1 };
  }
}

function countIssues(output) {
  const lines = output.split('\n').filter(l => l.trim());
  return lines.filter(l => /error|warning/i.test(l)).length;
}

for (const check of checks) {
  if (check === 'eslint') {
    const result = run('npx eslint . --ext .js,.jsx,.ts,.tsx --max-warnings 0 --format compact 2>&1 || true');
    const issues = countIssues(result.stdout);
    if (issues === 0) {
      lines.push('✅ **ESLint** — sin errores ni advertencias.');
    } else {
      const penalty = Math.min(maxPoints * 0.6, issues * 2);
      score -= penalty;
      const preview = result.stdout.split('\n').slice(0, 6).join('\n');
      lines.push(`⚠️ **ESLint** — ${issues} problema(s) encontrado(s):\n\`\`\`\n${preview}\n\`\`\``);
    }
  }

  if (check === 'htmlhint') {
    const result = run('npx htmlhint "**/*.html" 2>&1 || true');
    const issues = (result.stdout.match(/error/gi) || []).length;
    if (issues === 0) {
      lines.push('✅ **HTMLHint** — HTML válido, sin errores.');
    } else {
      score -= Math.min(maxPoints * 0.5, issues * 3);
      const preview = result.stdout.split('\n').slice(0, 6).join('\n');
      lines.push(`⚠️ **HTMLHint** — ${issues} error(es) de HTML:\n\`\`\`\n${preview}\n\`\`\``);
    }
  }

  if (check === 'stylelint') {
    const configPath = path.join(__dirname, '.stylelintrc.json');
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify({ extends: ['stylelint-config-standard'] }));
    }
    const result = run(`npx stylelint "**/*.css" --config ${configPath} 2>&1 || true`);
    const issues = (result.stdout.match(/✖/g) || []).length;
    if (issues === 0) {
      lines.push('✅ **Stylelint** — CSS sin problemas de estilo.');
    } else {
      score -= Math.min(maxPoints * 0.5, issues * 2);
      const preview = result.stdout.split('\n').slice(0, 6).join('\n');
      lines.push(`⚠️ **Stylelint** — ${issues} problema(s) en CSS:\n\`\`\`\n${preview}\n\`\`\``);
    }
  }

  if (check === 'typescript') {
    const result = run('npx tsc --noEmit 2>&1 || true');
    const errors = (result.stdout.match(/error TS/g) || []).length;
    if (errors === 0) {
      lines.push('✅ **TypeScript** — compilación sin errores.');
    } else {
      score -= Math.min(maxPoints * 0.7, errors * 3);
      const preview = result.stdout.split('\n').slice(0, 8).join('\n');
      lines.push(`❌ **TypeScript** — ${errors} error(es) de compilación:\n\`\`\`\n${preview}\n\`\`\``);
    }
  }
}

if (checks.length === 0) {
  lines.push('ℹ️ No se configuraron verificaciones de calidad para esta tarea.');
}

score = Math.max(0, Math.round(score));
core.setOutput('score', score.toString());
core.setOutput('feedback', lines.join('\n\n'));
console.log(`Calidad: ${score}/${maxPoints}`);
