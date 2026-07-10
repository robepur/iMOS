# Build 005 | Secure Secrets and Credential Management

## Mission

Provide encrypted credential and secure note management inside the unlocked iMOS personal vault without expanding into browser autofill.

## Delivered

1. Encrypted credential records inside `PersonalData`
2. Secure notes
3. Categories
4. Search and category filtering
5. Favorite records
6. Controlled password reveal
7. Username and password copy controls
8. Thirty second clipboard clearing attempt
9. Access, copy, create, update, and delete timeline events
10. Backward compatibility for vaults created before Build 005
11. Responsive Secrets Console

## Security Boundaries

Secrets are persisted only as part of the AES GCM encrypted vault envelope.

Secrets exist in application memory only while the vault is unlocked.

Locking the vault clears the in memory `PersonalData` object and active passphrase state.

Passwords remain masked by default.

Secret access and copy actions update the encrypted vault timeline.

Clipboard clearing is best effort because browser clipboard permissions may deny delayed reads or writes.

Browser autofill, extensions, background access, remote sync, and external secret injection are excluded.

## Data Model

Each secret record contains:

* Identifier
* Title
* Category
* Username
* Password
* URL
* Secure notes
* Favorite status
* Created timestamp
* Updated timestamp
* Last accessed timestamp

## Acceptance Criteria

* Existing vaults unlock without migration failure
* New secret records persist after lock and unlock
* Password values remain masked until explicitly revealed
* Copy actions produce an access timeline event
* Search matches title, username, URL, category, and notes
* Category filtering does not expose secret contents outside the unlocked session
* Delete requires confirmation
* Build validation passes

## Deferred

Autofill remains deferred to an independent security reviewed build because it requires browser page access, origin matching, injection controls, and stronger reauthentication policy.
