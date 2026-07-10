# Build 002 | Local Personal Data Foundation

## Purpose

Create continuity across iMOS sessions without connecting to ARGUS or any external cloud service.

## Included

1. Browser local storage for personal operating data
2. Priority persistence
3. Commitment capture and completion
4. Decision capture and completion
5. Executive Timeline persistence
6. Reflection capture
7. Personal data export to JSON
8. Explicit local reset control
9. Visible data boundary statement

## Data boundary

Build 002 stores information in the browser local storage of the device running iMOS.

The application does not transmit this information to GitHub, ARGUS, or an external service.

Clearing browser storage or changing browsers may remove access to the local records. The operator should use Export before clearing data or moving devices.

## Security posture

Local storage provides device persistence, not encryption at rest. Sensitive personal records should not be entered until a future encrypted vault capability is implemented.

## Acceptance criteria

1. Data remains after browser refresh
2. Commitments can be captured and completed
3. Decisions can be captured and completed
4. Reflections create Timeline entries
5. Data can be exported
6. Data can be reset only after explicit confirmation
7. No ARGUS or external network connection exists
