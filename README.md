# Yotei

Expo/React Native study planner with authentication adapters, local SQLite storage, a study scheduler, and a spaced-repetition review queue.

## Start here

```bash
npm ci
npx expo start --clear
```

Run commands from the project root. On Windows PowerShell, use `npm.cmd` / `npx.cmd` if PowerShell blocks the `.ps1` shims. The correct server command is `npx expo start`, not `npx start`.

The project currently uses Expo SDK 57, React Native 0.86, React 19.2.3, and npm with `package-lock.json`.

## Demo

Real Appwrite authentication is currently enabled in [auth/index.js](auth/index.js). For the local demo below, set `USE_REAL_AUTH = false` and fully reload; Mock accounts are separate from Appwrite accounts.

| Field | Value |
| --- | --- |
| Email | `student@yotei.demo` |
| Password | `study12345` |
| Remember me | Off by default |

Sign in, open Settings, and select **Load Demo Data**. It replaces only the current account's local study records with 3 subjects, 6 tasks, 4 study blocks totaling exactly 240 minutes today, and 3 due reviews.

## Current screens

| Tab | Features |
| --- | --- |
| Home | Today's Focus, daily workload, task coaching, Mark Done, missed-session rescheduling |
| Library | Subject/task creation, subject filters, task list, scheduling sheet |
| Review | Topic creation by subject; due queue; Hard / Good / Easy ratings |
| Settings | Dark/light toggle, JSON data export/import, mock-only demo loader, Sign Out, fixed student motto |

Completing a study block prompts the user to add a review topic under the same subject. Rescheduling a missed block increments the task's postponement count once. Coaching appears at a count of 2 or more.

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
