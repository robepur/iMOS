export class ReplayProtectionRegistry {
  private readonly entries = new Map<string, number>()

  constructor(private readonly maxEntries = 1024) {}

  private prune(nowMs: number): void {
    for (const [key, expiresMs] of this.entries.entries()) {
      if (expiresMs <= nowMs) this.entries.delete(key)
    }
    if (this.entries.size <= this.maxEntries) return
    const ordered = [...this.entries.entries()].sort((a, b) => a[1] - b[1])
    while (this.entries.size > this.maxEntries && ordered.length > 0) {
      const [key] = ordered.shift() as [string, number]
      this.entries.delete(key)
    }
  }

  consumeOnce(key: string, expiresAt: string, now = new Date()): boolean {
    const nowMs = now.getTime()
    const expiresMs = Date.parse(expiresAt)
    if (!Number.isFinite(expiresMs) || expiresMs <= nowMs) return false
    this.prune(nowMs)
    if (this.entries.has(key)) return false
    this.entries.set(key, expiresMs)
    this.prune(nowMs)
    return true
  }
}

