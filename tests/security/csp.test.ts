import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Content Security Policy', () => {
  it('index.html contains CSP meta tag', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8')
    expect(html).toContain('Content-Security-Policy')
    expect(html).toContain("default-src 'none'")
    expect(html).toContain("connect-src 'none'")
  })
})
