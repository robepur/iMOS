import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

describe('Network boundary security scan', () => {
  it('security-boundary-check passes on the source directory', () => {
    expect(() => {
      execSync('node scripts/security-boundary-check.mjs', {
        cwd: path.resolve(__dirname, '../..'),
        stdio: 'pipe'
      })
    }).not.toThrow()
  })

  it('Build 017 connectivity transport remains inert (contract only)', () => {
    const root = path.resolve(__dirname, '../..')
    const source = fs.readFileSync(path.join(root, 'src/services/ConnectivityTransport.ts'), 'utf8')
    expect(source.includes('interface ConnectivityTransport')).toBe(true)
    expect(source.includes('class')).toBe(false)
    expect(source.includes('new URL(')).toBe(false)
  })

  it('Build 018 identity service does not expose private-key export paths', () => {
    const root = path.resolve(__dirname, '../..')
    const source = fs.readFileSync(path.join(root, 'src/services/DeviceIdentityService.ts'), 'utf8')
    expect(source.includes('exportKey(\'pkcs8\'')).toBe(false)
    expect(source.includes('exportKey("pkcs8"')).toBe(false)
    expect(source.includes('localStorage')).toBe(false)
  })

  it('Build 019 permits fetch only within the approved sync adapter boundary', () => {
    const root = path.resolve(__dirname, '../..')
    const srcDir = path.join(root, 'src')
    const tsFiles: string[] = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) tsFiles.push(full)
      }
    }
    walk(srcDir)
    const filesUsingFetch = tsFiles
      .filter((file) => fs.readFileSync(file, 'utf8').match(/(?:\bfetch\s*\(|\b(?:globalThis|window|self)\s*\.\s*fetch\s*\(|\b(?:globalThis|window|self)\s*\[\s*['"`]fetch['"`]\s*\]\s*\()/))
      .map((file) => path.relative(root, file).replace(/\\/g, '/'))
      .sort()
    expect(filesUsingFetch).toEqual(['src/services/SyncTransportAdapter.ts'])
  })
})
