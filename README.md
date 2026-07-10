# iMOS

**Individual Mission Operating System**

A private first, standalone personal operating environment built for one operator.

## Mission

iMOS helps the operator stay ahead of reality through trusted observation, disciplined reasoning, purposeful execution, and a lasting partnership with Rosie.

## Current build

Build 012A completes Phase Two foundation and intelligence hardening:

1. Encrypted Personal Vault with backup, verification, restore, and passphrase rotation
2. Secure Secrets management inside the encrypted local vault
3. Priority Command and Rosie Memory operating loop
4. Review Center, timeline, commitments, decisions, and operator statistics
5. Modular core architecture with migration and validation coverage
6. Rosie recommendations, Knowledge Graph, and deterministic Understanding Engine
7. Deterministic Mission Planning with lifecycle integrity, transactional updates, and regression coverage

See `docs/builds/BUILD_012A.md` for Phase Two finalization details.

## Vault security

• AES GCM 256 authenticated encryption
• PBKDF2 SHA 256 key derivation
• 310,000 derivation iterations
• Random salt for every encrypted save
• Random initialization vector for every encrypted save
• Passphrase held only in application memory while unlocked
• Encrypted export for operator controlled backup
• Automatic migration from Build 002 plaintext local storage after vault creation

The passphrase is never stored and cannot be recovered by iMOS. Losing the passphrase means losing access to the encrypted vault unless an accessible backup and the correct passphrase remain available.

## Product boundaries

• Personal use only
• No ARGUS connection
• No multi tenant architecture
• No external integrations
• No personal data committed to source control
• Personal vault remains in local browser storage

## Local development

```bash
pnpm install
pnpm run dev
```

## Security

The repository must not contain secrets, credentials, personal records, calendar data, email content, passphrases, encrypted vault exports, or private operator memory.
