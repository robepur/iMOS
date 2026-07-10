# iMOS

**Individual Mission Operating System**

A private first, standalone personal operating environment built for one operator.

## Mission

iMOS helps the operator stay ahead of reality through trusted observation, disciplined reasoning, purposeful execution, and a lasting partnership with Rosie.

## Current build

Build 003 establishes an encrypted local operating loop:

1. Create or unlock the Personal Vault
2. Receive the Rosie executive brief
3. Capture commitments and decisions
4. Enter a protected focus session
5. Complete an executive reflection
6. Re encrypt changes automatically
7. Lock the vault when finished

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
npm install
npm run dev
```

## Security

The repository must not contain secrets, credentials, personal records, calendar data, email content, passphrases, encrypted vault exports, or private operator memory.
