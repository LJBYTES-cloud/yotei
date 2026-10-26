# Yotei

Expo/React Native study planner with authentication adapters, local SQLite storage, a study scheduler, and a subject-grouped reflection journal.

## Start here

```bash
npm ci
npx expo start --clear
```

Run commands from the project root. On Windows PowerShell, use `npm.cmd` / `npx.cmd` if PowerShell blocks the `.ps1` shims. The correct server command is `npx expo start`, not `npx start`.

The project currently uses Expo SDK 57, React Native 0.86, React 19.2.3, and npm with `package-lock.json`.

## Demo

Real Appwrite authentication is currently enabled in [auth/index.js](auth/index.js). Load Demo Data is available to every signed-in account, including Appwrite accounts, for presentations. It replaces that account's local study data. To use the built-in Mock credentials below, set `USE_REAL_AUTH = false` and fully reload; Mock and Appwrite accounts remain independent.

| Field | Value |
| --- | --- |
| Email | `student@yotei.demo` |
| Password | `study12345` |
| Remember me | Off by default |

Sign in, open Settings, and select **Load Demo Data**. It replaces only the current account's local study records with 3 subjects, 6 tasks, 10 study blocks (4 totaling exactly 240 planned minutes today, plus 6 completed sessions on the previous six days), 3 reflections, and 3 material links. Demo tasks include descriptions.

## Current screens

| Tab | Features |
| --- | --- |
| Home | Seven-day Weekly Progress chart, Today's Focus, commitment timer, work/break tracking, lateness, actual studied totals, daily workload, coaching, missed-session rescheduling, small student motto footer |
| Library | Bookshelf only, Add Subject, animated covers opening a dedicated subject notebook with scoped tasks, New Task, Edit Book and confirmed Delete Book |
| Reflections | Optional post-session notes and standalone notes; chronological journal grouped by subject |
| Settings | Saved light/dark journal theme, JSON data export/import, presentation demo loader (both auth adapters), Sign Out |

Finishing a study block prompts the user to reflect on that session. The note retains the subject and optional completed-block link; skipping leaves the block done. Rescheduling a missed block increments the task's postponement count once. Coaching appears at a count of 2 or more.

Task cards offer Edit and Delete. Editing keeps the task ID and study history; deleting removes its study blocks while preserving subject reflections (detaching deleted session links) and material notes. A future scheduled block hides the task's Missed Session badge, including sessions next week, without removing missed history from Home.

Subject forms offer twelve outlined color swatches, including pure Black and White. Browser startup shows a themed mobile-only notice; the web database module excludes SQLite/WASM entirely. Use Android/iOS for authentication and study features.

Schedule sessions with native Start/End calendar and clock pickers, including dates next week or later. Optionally type a duration such as 4h 30m, 45m or 2h to calculate End from Start. Moving Start keeps the duration; manually editing End clears the shortcut. Invalid drafts block Save. Validation compares timestamps with now, and SQLite calculates elapsed minutes for the existing workload warning. General instructions open themed Merriweather/Inter dialogs through small info icons; errors and overwrite/workload warnings remain visible. Subject books show code-only vertical spines with binding/page details. Tap a spine to reveal its full-name front cover, then open the cover into its dedicated task notebook or use its pencil to edit.

Subjects have a Subject Code, Field of Study, and one or two colors. Codes normalize to uppercase and default to GEN-101 for existing subjects without changing IDs/history. Each field gets a horizontal shelf; gradient books retain rotated codes, cover titles and binding/page details in both themes, with reduced-motion support. Light mode uses warm cream/forest green; dark mode uses greenish-black/soft green. Merriweather headings and Inter body text load from bundled assets in App.js. Books retain their stored field colors. Both themes use identical vibrant field gradients; dark-mode titles/codes use light ink on dark paper labels. Close smoothly returns each cover to its spine, including interrupted animations. Each shelf has a + button that prefills its field in Add Subject; the field dropdown offers existing names and accepts new ones. Light is the fallback for missing/invalid/unreadable theme preferences; a saved Dark choice still restores. Theme choice is saved on this device with AsyncStorage before screens mount. All screens share H1 28 / H2 22 / H3 18 / Body 14 / Small 12 / Button 14, with 36 reserved for timer/workload numerals. Existing subject colors migrate automatically into the General field; backup exports use version 5 with task descriptions and reflection notes/session links; versions 1-4 still import, converting legacy review topics into notes.

Home's **Weekly Progress** chart shows seven local calendar dates, including zero-minute days. Completed focus sessions contribute actual work minutes with breaks excluded; older untimed completions use their scheduled duration. Each session is credited to its local completion date. Tap a chart point for the date, total minutes and completed tasks, including allocated session time, actual study/break/elapsed minutes and finish overruns. Tap the chart background for total studied, seven-day daily average and best day; day rows in that summary also open details. The forest-green/soft-green chart follows the selected theme and shared data refresh.

On Home, choose **Start Session** during a block's scheduled window. The focus timer records actual work and breaks, shows lateness, and restores its mode after a restart. **Take Break** pauses work; **Resume Work** continues it. **Finish Session** freezes actual studied time and opens the optional reflection-note sheet. One session can run per account; active sessions remain accessible after their scheduled end or midnight. Work or break time continues while away according to the selected mode. The workload guardrail still uses planned duration, including active blocks.

Subject creation/editing refreshes silently. Shared success messages slide up above the bottom tab bar and expire after three seconds; Settings suppresses and discards these messages, including backup notices. Errors remain inline. Static headings, field labels and action buttons use Title Case; user-entered names and explanatory sentences retain their original casing. Library uses a nested Expo Router stack: /library is the shelf and /library/[subjectId] is the opened notepad.

Each opened book includes Study Materials: add/edit/delete a title and website or full file location. Tapping a reference uses Linking.openURL; nothing is uploaded or copied. An inaccessible location shows a recoverable error. Task forms include an optional multiline description shown in the notebook.

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

Settings > **Data Management** exports the signed-in account's five SQLite collections as JSON through the native share sheet. Importing a Yotei JSON backup replaces only that account's local data after validation, in a single transaction. The screen includes the overwrite warning. Login sessions and attached file contents are excluded; material notes and file paths are included. See [DATA_BACKUP.md](docs/DATA_BACKUP.md).

## Portable source handoff

The handoff includes a source ZIP, a Git history bundle, a file-hash manifest, and snapshot metadata. Generated packages are placed in the ignored `handoff/` directory.

To regenerate on Windows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/create-handoff.ps1
```

The ZIP contains current source, assets, documentation, tests, and committed history. Dependencies, Metro caches, native build outputs, and device SQLite/SecureStore contents are excluded. A source snapshot includes uncommitted files; the Git bundle contains committed history only. Installation and restoration steps are included inside the ZIP.
