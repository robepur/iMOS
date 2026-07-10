import { describe, it, expect, beforeEach } from 'vitest'
import { encryptVault, decryptEnvelope } from '../../src/vault'
import type { PersonalData } from '../../src/localData'

const SAMPLE_DATA: PersonalData = {
  version: 1,
  priorities: [],
  commitments: [],
  decisions: [],
  timeline: [],
  reflections: [],
  secrets: [],
}

const PASSPHRASE = 'correct-horse-battery-staple-secure'

describe('vault encryption / decryption', () => {
  it('encrypts and decrypts round-trip correctly', async () => {
    const envelope = await encryptVault(SAMPLE_DATA, PASSPHRASE)
    const decrypted = await decryptEnvelope(envelope, PASSPHRASE)
    expect(decrypted).toMatchObject(SAMPLE_DATA)
  })

  it('produces different ciphertext each call (random IV)', async () => {
    const e1 = await encryptVault(SAMPLE_DATA, PASSPHRASE)
    const e2 = await encryptVault(SAMPLE_DATA, PASSPHRASE)
    expect(e1.ciphertext).not.toBe(e2.ciphertext)
    expect(e1.iv).not.toBe(e2.iv)
  })

  it('rejects wrong passphrase', async () => {
    const envelope = await encryptVault(SAMPLE_DATA, PASSPHRASE)
    await expect(decryptEnvelope(envelope, 'wrong-passphrase-12345')).rejects.toThrow()
  })

  it('rejects passphrase shorter than 12 characters', async () => {
    await expect(encryptVault(SAMPLE_DATA, 'short')).rejects.toThrow()
  })
})
