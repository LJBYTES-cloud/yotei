# Yotei

Expo/React Native study planner with authentication adapters, local SQLite storage, a study scheduler, and a chronological study journal combining focus reflections with manual entries.

## Start here

```bash
npm ci
npx expo start --clear
```

Run commands from the project root. On Windows PowerShell, use `npm.cmd` / `npx.cmd` if PowerShell blocks the `.ps1` shims. The correct server command is `npx expo start`, not `npx start`.

The project currently uses Expo SDK 57, React Native 0.86, React 19.2.3, and npm with `package-lock.json`.

## Demo

Real Appwrite authentication is currently enabled in [auth/index.js](auth/index.js). Load Demo Data is visible and callable only when USE_REAL_AUTH === false. Real Appwrite accounts do not expose this reset action. To use the built-in Mock credentials below, set `USE_REAL_AUTH = false` and fully reload; Mock and Appwrite accounts remain independent.

| Field | Value |
| --- | --- |
| Email | `student@yotei.demo` |
| Password | `study12345` |
| Remember me | Off by default |

Sign in, open Settings, and select **Load Demo Data**. It replaces only the current account's local study records with six calendar months of history: 20 subjects across five fields, 40 unique described tasks, hundreds of completed blocks, varied reflections/manual journal entries and 40 materials. Today retains its 240-minute planned-workload example; historical sessions include breaks, lateness, overruns and underruns. Counts vary with the calendar and weekday mix.

## Current screens

| Tab | Features |
| --- | --- |
| Home | Seven-day Weekly Progress chart, Today's Focus, commitment timer, work/break tracking, lateness, actual studied totals, daily workload, coaching, missed-session rescheduling, small student motto footer |
| Library | Bookshelf only, Add Subject, animated covers opening a dedicated subject notebook with scoped tasks, New Task, Edit Book and confirmed Delete Book |
| Journal | Unified newest-first timeline; tap entries to read/edit on a dedicated screen; New Entry opens a keyboard-aware sheet |
| Settings | Saved light/dark journal theme, JSON data export/import, Mock-only demo loader, editable Display Name, Sign Out |

Finishing a study block prompts the user to reflect on that session. The note retains the subject and optional completed-block link; skipping leaves the block done. Rescheduling a missed block increments the task's postponement count once. Home shows one Coach note in priority order: an overdue incomplete task, repeated postponement, a day above 240 planned minutes, a completion today and yesterday, then an optional most-studied-hour suggestion after sufficient history. The most-postponed task wins ties by ID. Task-level five-minute coaching remains in the notebook.

Task and material cards use a top-right kebab menu for Edit and confirmed Delete. Editing keeps the task ID and study history; deleting removes its study blocks while preserving subject reflections (detaching deleted session links) and material notes. A future scheduled block hides the task's Missed Session badge, including sessions next week, without removing missed history from Home.

Subject forms offer twelve outlined color swatches, including pure Black and White. Browser startup shows a themed mobile-only notice; the web database module excludes SQLite/WASM entirely. Use Android/iOS for authentication and study features.

Schedule sessions with native Start/End calendar and clock pickers, including dates next week or later. Optionally type a duration such as 4h 30m, 45m or 2h to calculate End from Start. Moving Start keeps the duration; manually editing End clears the shortcut. Invalid drafts block Save. Validation compares timestamps with now, and SQLite calculates elapsed minutes for the existing workload warning. General instructions open themed Merriweather/Inter dialogs through small info icons; errors and overwrite/workload warnings remain visible. Subject books show code-only vertical spines with binding/page details. Tap a spine to reveal its full-name front cover, then open the cover into its dedicated task notebook or use its pencil to edit.

Subjects have a Subject Code, Field of Study, and one or two colors. New Subject Code drafts are empty, with only the e.g. GEN-101 placeholder, and require a valid code before saving. Existing/migrated subjects keep their saved codes and GEN-101 migration default without changing IDs/history. Each field gets a horizontal shelf; gradient books retain rotated codes, cover titles and binding/page details in both themes, with reduced-motion support. Light mode uses warm cream/forest green; dark mode uses greenish-black/soft green. Merriweather headings and Inter body text load from bundled assets in App.js. Books retain their stored field colors. Both themes use identical vibrant field gradients; dark-mode titles/codes use light ink on dark paper labels. Close smoothly returns each cover to its spine, including interrupted animations. Each shelf has a + button that prefills its field in Add Subject; the field dropdown offers existing names and accepts new ones. Light is the explicit startup default and the switch is OFF in Light Mode. Legacy plain-string preferences from the reversed-switch UI now reset to Light; corrected switches save version-2 preferences that restore explicit Dark choices. App startup/font hydration and native default appearance use a cream/Light fallback. Theme choice is saved on this device with AsyncStorage before screens mount. All screens share H1 28 / H2 22 / H3 18 / Body 14 / Small 12 / Button 14, with 36 reserved for timer/workload numerals. Existing subject colors migrate automatically into the General field; backup exports use version 6 with manual journal entries, task descriptions and reflection notes/session links. Versions 1-5 still import; pre-v6 files receive an empty manual-entry collection. File contents are not embedded in JSON; their permanent URIs are included.

Home's **Weekly Progress** chart shows seven local calendar dates, including zero-minute days. Completed focus sessions contribute actual work minutes with breaks excluded; older untimed completions use their scheduled duration. Each session is credited to its local completion date. Tap a chart point for the date, total minutes and completed tasks, including Scheduled/Actual/Overrun comparisons, work/break totals and separate late-finish details. Actual is elapsed work plus breaks; duration overrun is max(0, Actual - Scheduled), while a late finish compares clock end times. Points have visible 7px dots and transparent 44px touch targets. Tap the chart background for total studied, seven-day daily average and best day; day rows in that summary also open details. The forest-green/soft-green chart follows the selected theme and shared data refresh. Its Y-axis rounds up to whole hours (0, 1h, 2h, etc.); unusually long days use larger whole-hour steps to keep at most six intervals. Actual point values and touch targets are unchanged.

On Home, choose **Start Session** during a block's scheduled window. The focus timer records actual work and breaks and restores its mode after a restart. Lateness appears only in the completion reflection sheet, using the saved actual start; exact, subminute and whole-minute starts are distinguished. **Take Break** pauses work; **Resume Work** continues it. **Finish Session** freezes actual studied time and opens the optional reflection-note sheet. One session can run per account; active sessions remain accessible after their scheduled end or midnight. Work or break time continues while away according to the selected mode. The workload guardrail still uses planned duration, including active blocks.

Subject creation/editing refreshes silently. Shared success messages slide up above the bottom tab bar and expire after three seconds; Settings suppresses and discards these messages, including backup notices. Errors remain inline. Settings omits redundant info icons; Data Management restores its themed JSON-backup explanation, and complex workload guidance remains available. Static headings, field labels and action buttons use Title Case; user-entered names and explanatory sentences retain their original casing. Library and Journal use nested Expo Router stacks. Add Subject and a subtle subject-count badge sit in the Library header; /library/[subjectId] opens the notebook and /journal/[entryId] opens a note. The four tabs remain unchanged.

Each opened book includes Study Materials. Browse File Manager is the primary editor action: the system picker selects a file and FileSystem copies it into the app's private documents directory. Saving persists that permanent URI in local_file_path. Manual URLs/paths remain a secondary option. Cancelled or replaced unsaved copies are cleaned up; committed files survive picker-cache cleanup/restarts. Tapping opens the location through the OS, with a recoverable error if no handler/access exists. Task forms include an optional multiline description shown in the notebook.

Home, Journal, Library and subject notebooks use memoized rows, stable callbacks and bounded FlatList windows. Shelves also virtualize their horizontal books. Animated shelves/notebook pages disable native clipping on iOS to prevent missing transformed content. A separate stable list context excludes toasts and sheet state; focused screen clocks no longer tick the workspace. Background queries reuse unchanged rows/arrays, and demo seeding compiles each SQL shape once in the existing atomic transaction.

The scheduling sheet has a contextual Switch to 12h / Switch to 24h control beside Session Times. It saves the same device-wide preference (default 24h); Settings no longer contains a time-format switch. All clock timestamps share utils/timeFormat.js, including schedules, journal dates, completion logs and coach hour suggestions; elapsed timers and chart study-hour axes remain durations. Android time dialogs follow the switch; iOS uses a formatted time button with a locale-controlled native spinner.

Scheduled Home blocks keep Start Session as the only main button and put Mark as Done/Delete Block in a top-right kebab. Tapping Start while another active/paused session exists shows a notice and leaves SQLite unchanged; early/pending starts remain disabled. The shared menu supports custom actions/labels while task/material Edit/Delete behavior stays intact. Manual completion records scheduled seconds and the current completion timestamp with no invented actual start or breaks; it credits today's chart and opens the optional reflection sheet. Delete removes only that scheduled block, preserving its task and other history.

Tap any Journal card to open its full-page detail screen under /journal/[entryId]. The keyboard-aware screen edits/deletes both manual entries and session reflections; reflection titles remain task-derived. Dates and session links survive edits, and deleting a note leaves the study session intact. Display Name updates through the auth adapter and local SessionContext immediately after success, preserving user.id and all SQLite study ownership. Mock session storage keeps its existing remember-me choice.

## Entry point and routes

The active chain is:

```text
package.json main: index.js
  -> URL polyfill
  -> expo-router/entry
  -> src/app/_layout.tsx
  -> App.js (providers and protected root stack)
  -> src/app/(tabs)/_layout.tsx
  -> screens/
```

`src/app/` is the active route directory. A separate, user-created `app/index.tsx` currently contains a Hello World page; it is included in the handoff snapshot for reference and was left intact. The verified Metro export selects `src/app/`. See [the routing notes](docs/PROJECT_CONTEXT.md#routing-and-bootstrap) before changing either directory.

## Verification

```bash
npx expo lint
npx tsc --noEmit
npm run test:auth
npm run test:db
npm run test:backup
npm run test:theme
node --experimental-vm-modules --test tests/focus-timer.test.cjs tests/subject-deletion.test.cjs
npx expo export --platform android --platform ios --output-dir .expo/verification
```

The Node tests use `node:sqlite` and experimental VM modules; Node 24 is the verified test environment. Results and limits are recorded in [docs/VALIDATION.md](docs/VALIDATION.md).

## Context and handoff

- [PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md): architecture, schema, service contracts, business rules, constraints, and known limits.
- [CHANGELOG.md](docs/CHANGELOG.md): feature slices, reworks, superseded decisions, and Git checkpoints.
- [DEMO_AND_TESTING.md](docs/DEMO_AND_TESTING.md): demo steps, end-to-end checks, troubleshooting, and Appwrite setup references.
- [NEXT_SESSION_PROMPT.md](docs/NEXT_SESSION_PROMPT.md): copyable context for a new chat or developer handoff.
- [VALIDATION.md](docs/VALIDATION.md): dated verification results.
- [DATA_BACKUP.md](docs/DATA_BACKUP.md): native data backup format, restore behavior, testing, and file-by-file implementation changelog.

Read [AGENTS.md](AGENTS.md) before changing Expo or React Native code. It defines the repository's versioned-documentation and validation workflow.

## Study data backup

Settings > **Data Management** exports the signed-in account's six SQLite collections as JSON through the native share sheet. Importing a Yotei JSON backup replaces only that account's local data after validation, in a single transaction. The screen includes the overwrite warning. Login sessions and attached file contents are excluded; material notes and file paths are included. See [DATA_BACKUP.md](docs/DATA_BACKUP.md).

## Portable source handoff

The handoff includes a source ZIP, a Git history bundle, a file-hash manifest, and snapshot metadata. Generated packages are placed in the ignored `handoff/` directory.

To regenerate on Windows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/create-handoff.ps1
```

The ZIP contains current source, assets, documentation, tests, and committed history. Dependencies, Metro caches, native build outputs, and device SQLite/SecureStore contents are excluded. A source snapshot includes uncommitted files; the Git bundle contains committed history only. Installation and restoration steps are included inside the ZIP.
