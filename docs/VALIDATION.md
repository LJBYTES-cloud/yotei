# Validation snapshot

Date: **2026-10-21, Asia/Singapore**. Baseline application commit: `edfb6ab`. The original source-handoff checks are recorded below, followed by the Data Backup implementation checks against the updated working tree.

## Checks run

| Check | Result |
| --- | --- |
| `npx.cmd expo lint` | Passed |
| `npx.cmd tsc --noEmit` | Passed |
| Combined auth + database tests, `TZ=Asia/Singapore` | 57 passed, 0 failed |
| Database tests, `TZ=America/New_York` | 38 passed, 0 failed |
| Android and iOS Expo export | Passed; assets including Ionicons resolved |
| Router source selection in export | `Using src/app as the root directory for Expo Router.` |

Export output: `.expo/handoff-verification/` (generated, ignored). Node emits expected experimental VM-module warnings during the tests. Metro may print terminal color-environment warnings; these did not fail the export.

## What the tests establish

- Both authentication adapters' remember-me, restoration, sign-out, error cleanup, and cold-boot contracts, using isolated storage/SDK substitutes.
- Production SQL, real SQLite constraints/joins/transactions, account isolation, safely bound values, persistence, migration, and retryable initialization.
- Task date queries, block ownership, missed detection, idempotent reschedules, and exactly-once postponement increments.
- Strict 240-minute workload behavior, cross-midnight splitting, simultaneous scheduling, custom duration/time validation, and daylight-saving boundaries.
- Review creation/due-time boundaries, 1/3/7-day intervals, duplicate-rating protection, persistence, and read-failure retry behavior.
- Demo reset isolation, repeatability, rollback, exact daily workload, and three due reviews.
- Full database integration: schedule -> Mark Done -> subject-linked review topic -> automatically missed second session -> reschedule twice -> task postpone_count 2.

## Limits of this evidence

- Native app startup/navigation, keyboard avoidance, modal animation, screen-reader behavior, and visual appearance have not been exercised on a physical device or simulator in this verification.
- Appwrite tests substitute the SDK; they do not exercise the populated live project configuration.
- `app/index.tsx` is a pre-existing Hello World experiment, not the active screen. It is preserved in the archive and is outside the current TypeScript include paths.
- No EAS build, installation artifact, store submission, cloud sync, or browser SQLite flow was verified.
- Device-local SQLite contents and SecureStore sessions are separate from the source and are not part of the source-handoff archive.

The archive script adds its own SHA-256 source manifest and Git bundle verification. Those checks establish package integrity and recoverable committed history, not application runtime behavior.

## Data Backup implementation checks

Run after adding native data backup and its Settings integration:

| Check | Result |
| --- | --- |
| `npx.cmd expo lint` | Passed |
| `npx.cmd tsc --noEmit` | Passed |
| `node --experimental-vm-modules --test tests/auth.test.cjs tests/database.test.cjs tests/backup.test.cjs` | 79 passed, 0 failed (19 auth, 38 database, 22 backup) |
| `npx.cmd expo install --check` | Dependencies are up to date |
| `npx.cmd expo export --platform android --platform ios --output-dir .expo/backup-verification` | Both platforms passed; `src/app/` selected |

Backup tests exercise production SQL against real SQLite, with native FileSystem/Sharing/DocumentPicker substitutes. They cover all five collections, ownership, bound values, ID/reference remapping, material metadata, preserved review dates, arbitrary history row order, exact postponement counts, new rescheduling after import, round trips, picker cancellation, empty backups, BOM handling, invalid files, size limits, write/share errors, and rollback after a late insert failure.

The native picker, provider-specific MIME handling, share/save completion, and visual layout still require a phone check. A successful share-sheet call does not prove the user saved a copy. JSON preserves file paths rather than attachment bytes. No cloud sync or release build was added. See [DATA_BACKUP.md](DATA_BACKUP.md) for manual steps and the full change list.
