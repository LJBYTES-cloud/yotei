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

## Real authentication diagnostics checks

On 2026-10-21, enabled the real adapter after finding `USE_REAL_AUTH = false`, added error/configuration logs, preserved email normalization, and added config validation. `appwriteConfig.js` values were inspected and retained; `com.yotei.app` matches both app.json platform identifiers.

- `npx.cmd expo lint` and `npx.cmd tsc --noEmit`: passed.
- Combined auth/database/backup suites: **84 passed, 0 failed** (24 auth, 38 database, 22 backup).
- Five new auth tests cover the configured client target, email/name trimming, original duplicate-email/login error details and propagation, signup's automatic-login rejection, and invalid config. Tests substitute the Appwrite SDK and capture console logs; they do not use real account credentials.
- Read-only live `GET https://sgp.cloud.appwrite.io/v1/account`, with configured project ID `6ad4b5890028097c1d28`: **401**, `general_unauthorized_scope`, `User (role: guests) missing scopes (["account"])`. No credentials, API key, creation request, or session write were sent.

The guest probe establishes reachability and that the request reached an account permission check. It does not establish that the user inspected the same Console project, that native platforms are registered there, or that a real email/password login succeeds. Fully reload the app and capture the new signIn/signUp error entries for any remaining live failure. No fresh native bundle export or device interaction was performed in this diagnostics pass.

## UX polish checks (2026-10-22, Asia/Singapore)

Validated the keyboard, spacing, manual start/end scheduler, and bookshelf changes against the current Expo `~57.0.31` / React Native `0.86.3` workspace:

| Check | Result |
| --- | --- |
| `npx.cmd expo lint` | Passed |
| `npx.cmd tsc --noEmit` | Passed |
| Combined auth/database/backup tests with `TZ=Asia/Singapore` | 89 cases: 88 passed, 0 failed, 1 New York DST-only test skipped |
| Database tests with `TZ=America/New_York` | All 43 passed, including DST-specific case |
| Android/iOS Expo export to `.expo/ux-verification` | Both platforms passed; active route root is `src/app/` |

The new time-window coverage verifies strict HH:mm/day validation, past/equal/reversed rejection, 5/30/original-duration defaults, midnight/year-boundary initialization, exactly 240 elapsed minutes, above-threshold interception/override, per-day overnight workload, exactly-once reschedule counts, nonexistent/repeated local clock behavior, and actual elapsed minutes through DST.

Read-only UI review found and resolved two layout issues: sheet scrolling must compare the input with the actual native scroll viewport (including header placement), and book titles need intrinsic height for larger text. The bundle imports only the existing Ionicons family for bookshelf icons. No packages or database schema/services changed.

Node tests and bundles do not exercise a real keyboard. On small iOS/Android devices, check every sheet with the keyboard open, scroll to its action buttons, test large text, dismiss/reopen without losing drafts, and verify all bookshelf columns/filter states in both themes. Follow the updated [manual checks](DEMO_AND_TESTING.md#manual-acceptance-checks).
