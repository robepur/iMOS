import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const srcDir = path.join(root, 'src')

const blockedPatterns = [
  { label: 'fetch', regex: /fetch\s*\(/ },
  { label: 'XMLHttpRequest', regex: /XMLHttpRequest/ },
  { label: 'axios', regex: /axios/ },
  { label: 'WebSocket', regex: /WebSocket/ },
  { label: 'EventSource', regex: /EventSource/ },
  { label: 'navigator.sendBeacon', regex: /navigator\.sendBeacon/ },
  { label: 'RTCPeerConnection', regex: /RTCPeerConnection/ },
  { label: 'WebTransport', regex: /WebTransport/ },
  { label: 'external Worker URL', regex: /new\s+Worker\s*\(\s*['"`]https?:\/\// },
  { label: 'SharedWorker', regex: /SharedWorker/ },
  { label: 'serviceWorker.register', regex: /\.serviceWorker\.register/ },
  { label: 'external script injection', regex: /createElement\s*\(\s*['"`]script['"`]\s*\)/ },
  { label: 'dynamic import from remote', regex: /import\s*\(\s*['"`]https?:\/\// },
]

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walk(full))
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(full)
  }
  return files
}

const violations = []
for (const file of walk(srcDir)) {
  const text = fs.readFileSync(file, 'utf8')
  for (const pattern of blockedPatterns) {
    if (pattern.regex.test(text)) {
      violations.push(`${pattern.label} in ${path.relative(root, file)}`)
    }
  }
}

if (violations.length > 0) {
  console.error('Security boundary violations detected:')
  violations.forEach((v) => console.error(`- ${v}`))
  process.exit(1)
}

console.log('Security boundary check passed.')
