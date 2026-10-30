import fs from 'node:fs';
import path from 'node:path';

function escapeXml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function main() {
  const inputPath = path.resolve(process.cwd(), 'docs/demo-output.txt');
  const outputPath = path.resolve(process.cwd(), 'docs/demo.svg');

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const rawText = fs.readFileSync(inputPath, 'utf8');
  const rawLines = rawText.split(/\r?\n/);

  // Filter out leading security warning for visual appeal, keep everything else
  const lines = rawLines.filter((l) => !l.includes('[SECURITY WARNING]'));

  const lineHeight = 19;
  const paddingY = 55;
  const paddingX = 24;
  const width = 850;
  const height = Math.max(600, lines.length * lineHeight + paddingY + 30);

  // Group lines into timed reveal steps
  // Total duration ~14s, repeating or holding at end
  const totalSteps = lines.length;
  const stepDelay = 0.12; // 120ms per line

  let textSvg = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const y = paddingY + i * lineHeight;
    const delay = (i * stepDelay).toFixed(2);

    let color = '#c9d1d9'; // default terminal text
    let weight = 'normal';

    if (line.includes('=====')) {
      color = '#388bfd';
    } else if (line.startsWith('[STAGE') || line.includes('STORYBOARD') || line.includes('DEMO EXECUTION SUMMARY')) {
      color = '#58a6ff';
      weight = 'bold';
    } else if (line.includes('✔') || line.includes('PASSED') || line.includes('Clean: true')) {
      color = '#3fb950';
      weight = 'bold';
    } else if (line.includes('❌') || line.includes('FAILED')) {
      color = '#f85149';
      weight = 'bold';
    } else if (line.includes('MISSING') || line.includes('self_heal') || line.includes('Goal:')) {
      color = '#d29922';
    } else if (line.includes('CACHE HIT') || line.includes('Zero-Cost')) {
      color = '#a371f7';
      weight = 'bold';
    } else if (line.includes('export default') || line.includes('function execute') || line.startsWith('    ')) {
      color = '#79c0ff';
    } else if (line.includes('[GoalRouter]') || line.includes('[Synthesizer]') || line.includes('[Sandbox]') || line.includes('[Microkernel]')) {
      color = '#8b949e';
    }

    const escaped = escapeXml(line);
    textSvg += `    <text x="${paddingX}" y="${y}" class="line" style="animation-delay: ${delay}s; fill: ${color}; font-weight: ${weight};">${escaped}</text>\n`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}">
  <defs>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#161b22"/>
      <stop offset="100%" stop-color="#0d1117"/>
    </linearGradient>
  </defs>
  <style>
    .window-bg { fill: #0d1117; stroke: #30363d; stroke-width: 1.5; rx: 10; ry: 10; }
    .header-bar { fill: url(#headerGrad); rx: 10; ry: 10; }
    .term-title { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 600; fill: #8b949e; text-anchor: middle; }
    .line {
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
      font-size: 12.5px;
      opacity: 0;
      animation: revealLine 0.2s cubic-bezier(0.2, 0, 0, 1) forwards;
    }
    @keyframes revealLine {
      from { opacity: 0; transform: translateY(2px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>

  <!-- Window Container -->
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" class="window-bg" />

  <!-- Window Header -->
  <path d="M 1 10 C 1 5, 5 1, 10 1 L ${width - 10} 1 C ${width - 5} 1, ${width - 1} 5, ${width - 1} 10 L ${width - 1} 36 L 1 36 Z" fill="#161b22" />
  <circle cx="20" cy="18" r="6" fill="#ff5f56" />
  <circle cx="38" cy="18" r="6" fill="#ffbd2e" />
  <circle cx="56" cy="18" r="6" fill="#27c93f" />
  <text x="${width / 2}" y="22" class="term-title">AetherFlow v0.1 — Real Terminal Replay (gemini-3.5-flash-lite JIT Tool Synthesis &amp; Self-Healing Loop)</text>

  <!-- Terminal Output Lines -->
  <g>
${textSvg}  </g>
</svg>
`;

  fs.writeFileSync(outputPath, svg, 'utf8');
  console.log(`Generated animated SVG terminal replay at: ${outputPath} (${lines.length} lines, ${height}px height)`);
}

main();
