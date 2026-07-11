import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const srcDir = path.join(root, 'src')

const blockedPatterns = [
  { label: 'fetch', regex: /\bfetch\s*\(/ },
  { label: 'XMLHttpRequest', regex: /\bXMLHttpRequest\b/ },
  { label: 'axios', regex: /\baxios\b/ },
  { label: 'WebSocket', regex: /\bWebSocket\b/ },
  { label: 'EventSource', regex: /\bEventSource\b/ },
  { label: 'navigator.sendBeacon', regex: /\bnavigator\.sendBeacon\b/ },
  { label: 'RTCPeerConnection', regex: /\bRTCPeerConnection\b/ },
  { label: 'WebTransport', regex: /\bWebTransport\b/ },
  { label: 'external Worker URL', regex: /\bnew\s+Worker\s*\(\s*['"\x60]https?:\/\// },
  { label: 'SharedWorker', regex: /\bSharedWorker\b/ },
  { label: 'serviceWorker.register', regex: /\.serviceWorker\.register\b/ },
  { label: 'external script element', regex: /createElement\s*\(\s*['"\x60]script['"\x60]\s*\)/ },
  { label: 'external image element', regex: /\bnew\s+Image\s*\(|createElement\s*\(\s*['"\x60]img['"\x60]\s*\)/ },
  { label: 'external iframe element', regex: /createElement\s*\(\s*['"\x60]iframe['"\x60]\s*\)/ },
  { label: 'external form action', regex: /\.action\s*=\s*['"\x60]https?:\/\// },
  { label: 'external resource assignment', regex: /\.(?:src|href)\s*=\s*['"\x60]https?:\/\// },
  { label: 'external CSS URL', regex: /url\s*\(\s*['"]?https?:\/\// },
  { label: 'dynamic import from remote', regex: /\bimport\s*\(\s*['"\x60]https?:\/\// },
  { label: 'remote location redirect', regex: /\b(?:window\.)?location(?:\.href)?\s*=\s*['"\x60]https?:\/\// },
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
  const source = fs.readFileSync(file, 'utf8')
  for (const pattern of blockedPatterns) {
    if (pattern.regex.test(source)) violations.push(pattern.label + ' in ' + path.relative(root, file))
  }
}

if (violations.length > 0) {
  console.error('Security boundary violations detected:')
  violations.forEach((violation) => console.error('- ' + violation))
  process.exit(1)
}

console.log('Security boundary check passed.')
