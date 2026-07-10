# Build 004 | Secure Backup and Vault Recovery

## Status

Implemented for review.

## Mission

Protect the iMOS personal vault from device loss, corruption, accidental deletion, and passphrase changes without exposing plaintext operator data.

## Delivered controls

1. Versioned `.imos` backup package
2. AES GCM encrypted vault payload
3. SHA 256 package checksum
4. Strict package and cryptographic parameter validation
5. Authenticated encrypted import
6. Recovery test mode that decrypts and validates without changing the active vault
7. Transactional restore after verification
8. Passphrase rotation with new salt, IV, and key material
9. Post rotation verification before replacing the active vault
10. Local recovery audit history
11. Fail closed handling for malformed, downgraded, corrupted, or incorrectly authenticated backups

## Backup package

```text
imos-backup
  version
  createdAt
  checksum
  vault
    version
    algorithm
    kdf
    iterations
    salt
    iv
    ciphertext
    updatedAt
```

The package contains no plaintext personal data, passphrase, or raw encryption key.

## Recovery sequence

```text
Select package
Verify format
Verify version
Verify KDF strength
Verify checksum
Authenticate AES GCM payload
Parse recovered data
Restore only after all checks pass
Audit result
```

## Recovery testing

`testRecovery` validates the complete backup and decrypts it in memory. It reports the recovered record count and never writes the tested package to the active vault.

## Passphrase rotation

`rotatePassphrase` first authenticates the current passphrase. It then creates new encryption material, encrypts the active data, decrypts the replacement as a verification step, and only then replaces the stored vault.

## Security boundaries

1. Storage destinations remain untrusted
2. Imported files remain untrusted until verified
3. Recovery fails closed
4. No partial restore is allowed
5. No previous key material is reused
6. The active vault is not changed during recovery testing

## Remaining presentation work

The recovery engine is complete. A dedicated visual recovery console can now call the exported functions from `src/vault.ts` without duplicating cryptographic logic.
