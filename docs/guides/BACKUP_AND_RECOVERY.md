# Backup and Recovery Guide

**iMOS 0.1.0-rc.1**

---

## Why Back Up?

Your iMOS vault is stored in your browser's local storage. It will be lost if you:

- Clear your browser data
- Switch browsers or devices
- Reinstall your operating system
- Lose access to your machine

A backup lets you restore your complete vault — priorities, commitments, decisions, reflections, secrets, and all history — on any supported browser.

---

## Creating a Backup

1. Open iMOS and unlock your vault
2. Click **VAULT** in the top bar
3. Click **Export Backup** in the data panel
4. Save the backup file to a secure location
5. Do **not** store it in the same place as your passphrase

Your backup is encrypted. It cannot be opened without your passphrase.

**Recommended:** Create a new backup after any significant change to your vault — new priorities, decisions, or credentials.

---

## Restoring From a Backup

1. Open iMOS in any supported browser
2. At the vault lock or setup screen, look for the **Restore** option
3. Open the Recovery Console (**VAULT → Recovery Console**)
4. Upload your backup file
5. Enter your passphrase
6. Confirm the restore

Your vault will be decrypted and reloaded. All data from the backup will be restored.

---

## Rotating Your Passphrase

If you change your passphrase:

1. Open **VAULT → Recovery Console**
2. Select **Rotate Passphrase**
3. Enter your current passphrase and your new one
4. Confirm the rotation
5. **Create a new backup immediately** — your existing backup uses the old passphrase

---

## What a Backup Contains

- All priorities, commitments, decisions, reflections
- All secrets (encrypted)
- Mission plans and steps
- Rosie understandings and recommendations
- Your onboarding and pilot feedback

**What a backup does not contain:**
- Your passphrase (never stored)
- Any synchronisation credentials
- Any provider tokens

---

## Backup Readiness Checklist

- [ ] I have created at least one backup
- [ ] My backup is stored on a separate device or cloud storage
- [ ] My passphrase is stored separately from my backup
- [ ] I know how to access the Recovery Console
- [ ] I have tested that I can locate my backup file

---

## Getting Help

If you are unable to restore your vault and your backup file is unavailable, your data cannot be recovered. iMOS has no server-side copy and no recovery override.

This is by design — your data remains yours.
