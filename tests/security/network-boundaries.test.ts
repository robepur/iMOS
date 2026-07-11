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
})
