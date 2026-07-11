import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import path from 'node:path'

describe('Network boundary security scan', () => {
  it('security-boundary-check passes on the source directory', () => {
    expect(() => {
      execSync('node scripts/security-boundary-check.mjs', {
        cwd: path.resolve(__dirname, '../..'),
        stdio: 'pipe'
      })
    }).not.toThrow()
  })
})
