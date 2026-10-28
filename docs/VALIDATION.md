# Validation snapshot





## APK Local-Material Sharing (2026-10-29)

- `npx.cmd expo lint` and `npx.cmd tsc --noEmit`: clean. Focused material/UI tests: **64 passed**. Full 11-suite regression: **220 cases, 219 passed, 0 failed, 1 existing timezone skip**.
- File/component checks verify file:// uses Sharing.shareAsync with exact Open Material options; content:// stages to local cache first; neither uses Linking.openURL. HTTP/HTTPS still use Linking. Double taps submit once; share failures retain records, show reselection guidance and permit retry. Real helper tests verify cache contents, source preservation, failed-copy cleanup and retention while the receiving app reads.
- A held Directory.create promise proves no copy is attempted before it resolves. copyToCacheDirectory remains true, successful picks use Paths.document and the prior fallback remains covered. The installed expo-sharing Android source was inspected: shareAsync requires a file scheme and grants read access through its FileProvider.
- `npx.cmd expo config --type introspect --json`: passed; generated Android manifest includes android.permission.READ_EXTERNAL_STORAGE and android.permission.WRITE_EXTERNAL_STORAGE. Existing EAS project ID was preserved and eas.json was left untouched. An auth flag type assertion was corrected without switching its current runtime value.
- `npx.cmd expo export --platform android --platform ios --output-dir .expo/material-sharing-verification`: passed using src/app/. No dependencies/schema/backup changes. The finalized manual was not modified.
- These checks compile JS/assets and simulate native transports; they do not install an APK or prove PDF-viewer/provider behavior on a device. Rebuild/install the preview APK for manifest changes, then test a picked PDF, fallback provider reference, share dismissal and a web link. Revoked provider access can still require reselecting a document.

## Android Picker Copy-Failure Fallback (2026-10-29)

- `npx.cmd expo lint` and `npx.cmd tsc --noEmit`: clean. Focused file/component/database run: **132 cases, 131 passed, 1 existing timezone skip**. Full 11-suite regression: **214 cases, 213 passed, 0 failed, 1 existing timezone skip**.
- Native transport mocks now verify failed legacy copies and unavailable destination directories return the original URI with copied=false and console warnings, removing partial private copies while preserving provider originals. Successful private copies, cancellation and account cleanup continue passing.
- Actual MaterialSheet tests save long picked content references without the manual length error, pass local_file_path=null, retain the full URL, show the reference-specific label and never clean that reference on cancellation/unmount. Manual replacement restores validation; invalid drafts remain. Production SQL verifies stored URI equality, editing/open-link conversion and account isolation. Utility tests reject malformed content authorities while preserving valid percent-encoded IDs.
- Android/iOS exports passed using `npx.cmd expo export --platform android --platform ios --output-dir .expo/material-reference-verification`; active routes remain src/app/.
- No dependencies, schema/service contract or backup-version changes; previous UI/theme work and finalized USER_MANUAL.txt remain. Native Expo Go picker/provider interaction still requires a device check; URI access can be revoked later even when a reference saves successfully.

## File Copy, Shared Logo, Title Case and Theme Rendering (2026-10-29)

- `npx.cmd expo lint` and `npx.cmd tsc --noEmit`: passed without warnings/errors. Focused component/file/theme/root tests: **78 passed**. Full 11-suite regression: **210 cases, 209 passed, 0 failed, 1 existing timezone skip**.
- File transport tests simulate Android content-provider URIs that reject File construction; primary legacy copyAsync succeeds for them and cached file:// sources. Injected partial-copy failures retain the original error, delete only the destination, and preserve provider originals/other accounts. The root copyAsync mock deliberately throws, matching installed SDK 57. Docs verified: SDK 57 FileSystem and FileSystem Legacy supported URI schemes.
- Theme tests verify stable provider identity on unrelated renders, synchronous UI selection while persistence is held, one style-factory execution per palette across separate row instances, and reuse after returning to Light. Native root tests verify Application does not subscribe the session boundary to theme updates and navigation theme/options remain stable during auth-only renders. Existing hydration, ordering and storage-failure checks pass.
- Logo extraction reuses the same geometry/colors in auth and screen headers. Existing UI/timer/chart suites pass with the updated labels. No database/schema, backup, routing, dependency or native-config changes. Finalized USER_MANUAL.txt is unchanged.
- Android/iOS exports passed with `npx.cmd expo export --platform android --platform ios --output-dir .expo/final-fixes-verification`, using src/app/.
- Native provider permissions and real Expo Go file-manager interaction still need a device check. No physical theme-switch latency/FPS measurement was taken; identity/style-build assertions demonstrate eliminated work, not a millisecond guarantee.

## Performance and UI Polish (2026-10-29)

- `npx.cmd expo lint` and `npx.cmd tsc --noEmit`: passed with no warnings.
- Full 11-suite regression: **205 cases, 204 passed, 0 failed, 1 existing New York-specific skip** in Asia/Singapore. Command: `node --experimental-vm-modules --test tests/database.test.cjs tests/backup.test.cjs tests/task-library.test.cjs tests/material-files.test.cjs tests/notifications.test.cjs tests/subject-deletion.test.cjs tests/focus-timer.test.cjs tests/auth.test.cjs tests/theme.test.cjs tests/web-platform.test.cjs tests/dashboard-performance.test.cjs`.
- Database suite with `TZ=America/New_York`: **73 passed, 0 failed/skipped**. Six-month seed content, account isolation, rollback, workload, DST and timer rules are retained. A new prepared-statement transport exercises production SQL, verifies fewer than 20 distinct compiled statements for hundreds of blocks, and checks finalization on success/injected failure.
- New actual-hook performance tests verify a background query with 1,000 fresh result objects preserves the existing snapshot/rows; one changed row invalidates only itself and reordering preserves other identities. Local readiness clocks stop on blur/background and catch up on focus; list-context checks confirm notices do not change its value and shared state no longer publishes clock ticks.
- Component regressions cover dedicated Journal route IDs/invalid-entry redirects, full-page keyboard avoidance, both note kinds, immediate saved text without a successful refresh, retry drafts/cancel/deletion guards, Library header action/count, iOS clipping exception, contextual clock format without changing selected instants, reversible responsive covers and unchanged chart point/background actions. Full regression retains completion, active-session conflicts, backup and auth behavior.
- `npx.cmd expo export --platform android --platform ios --output-dir .expo/polish-verification`: passed, selecting `src/app/` with the nested Library/Journal stacks. No dependencies, schema, backup version or native configuration changed. USER_MANUAL.txt and the root app/index.tsx experiment were left untouched.
- Device timing/FPS was not measured. Tests prove reduced invalidation/SQL preparation, not a quantified native speedup. Check native stack/back gestures, narrow/large-text notebooks, animated shelf sizes, long-note keyboard editing and chart curves/fills/touch accuracy on Android/iOS in both themes. Node bridges and compiled exports do not establish rendered appearance.

## Scheduled-Card Menu and Active-Session Notice (2026-10-27)

- `npx.cmd expo lint` and `npx.cmd tsc --noEmit`: passed without warnings/errors. No dependency, schema, database-service or authentication changes.
- Focused actual-component suite: **45 passed, 0 failed**. Full ten-suite regression: **196 cases, 195 passed, 0 failed, 1 existing NY-specific skip** using the command below.
- Checks verify scheduled cards have one primary Start button with exact Mark as Done/Delete Block menu options, no inline secondary buttons, preserved early-start disabling and clickable eligible starts despite another session. Custom menu arrays/labels preserve legacy task/material Edit/Delete defaults, suppress duplicate selections, and invoke callbacks only after modal dismissal. Existing Android post-commit and iOS dismissal behavior remains covered.
- Workspace tests confirm active and paused session conflicts emit the exact global notice without a SQLite start, refresh or working state, while break/resume and unoccupied starts still invoke their services. Themed block deletion and all existing account/ownership/timer tests remain passing.
- Android/iOS exports passed with `npx.cmd expo export --platform android --platform ios --output-dir .expo/scheduled-menu-verification`; Metro selected src/app/. Physical-device menu placement, larger-text header wrapping, toast placement and native modal transitions still need manual checks. Current file-by-file changes are in CHANGELOG.md.

## Themed Block Confirmation and Horizontal Actions (2026-10-27)

- `npx.cmd expo lint` and `npx.cmd tsc --noEmit`: passed without warnings/errors. No dependency, schema, database-service or auth changes.
- Focused UI suites: **49 passed, 0 failed**. The ten-suite regression command in the preceding snapshot now reports **194 cases, 193 passed, 0 failed, 1 existing NY-specific skip**.
- Actual-component bridge checks verify the three scheduled actions share one parent row, Start is primary and disabled before its window/while another timer is active, and action callbacks remain connected. Block deletion opens the custom modal without native Alert; cancel writes nothing, duplicate confirms issue one delete, pending deletion cannot be dismissed, errors retain the selection for retry, and success closes/refreshes. Missing/resolved selections cannot open a prompt.
- Modal tests exercise cream/dark surfaces, Merriweather title and Inter body, error text, Cancel/backdrop/Android Back, destructive confirm, and busy dismissal/duplicate guards. These tests replace native bridges; rendered narrow-screen wrapping, large text and native touch/animation behavior still require a device check.
- Android/iOS exports passed with `npx.cmd expo export --platform android --platform ios --output-dir .expo/block-ui-verification`; Metro selected src/app/. Existing SQL deletion/ownership/history behavior is reused unchanged. Pre-existing edits were preserved. CHANGELOG.md lists every file changed in this pass.

## Settings, Manual Sessions, Journal Management, Profiles, and Coach (2026-10-27)

- `npx.cmd expo lint` and `npx.cmd tsc --noEmit`: passed. Dependencies, SQLite schema and backup version remain unchanged; all required native/storage modules were already installed. The real-auth flag stays true, with a widened boolean type for strict Mock-only checks.
- Ten suites: **192 cases, 191 passed, 0 failed, 1 existing NY-specific skip** in Asia/Singapore. Command: `node --experimental-vm-modules --test tests/database.test.cjs tests/backup.test.cjs tests/task-library.test.cjs tests/material-files.test.cjs tests/notifications.test.cjs tests/subject-deletion.test.cjs tests/focus-timer.test.cjs tests/auth.test.cjs tests/theme.test.cjs tests/web-platform.test.cjs`.
- Separate America/New_York database suite: **72 passed, 0 failed/skipped**. Timezone verification caught SQLite native-localtime disagreeing with JS; CoachService now aggregates UTC-minute instants and converts historical hours in JS. Tests cover local streak days, historical DST changes and account-scoped best-hour selection. Asia/Kathmandu checks also cover the non-whole-hour offset.
- Production SQLite coverage adds owned manual completion/deletion, exact scheduled-seconds credit on the action date, idempotent retry timestamps, active/missed rejection, preserved tasks/history, journal edit/delete for both source types, validation/SQL binding/account isolation, unchanged created_at/session links and intact study totals after note deletion. Backup tests round-trip valid manual completions and reject invalid status/totals/breaks without replacing existing data.
- Actual-component bridge tests cover strict Mock-only Settings rendering and action guard; restored JSON help; empty Subject Code drafts with exact placeholder and edit prefill; rapid duration replacement and final saved interval; scheduled-block actions/confirmation/duplicate locks; Journal full-text/editor/failure/cancel/delete behavior for both types; profile editor failure/retry and SessionContext immediate ID-preserving update/sign-out exclusion. Journal card taps are wired to the shared detail action.
- Adapter tests verify trimmed/validated name changes, stable IDs/emails/remember flags, remembered cold-boot restoration, signed-out rejection and old-profile preservation after storage/API failures. Appwrite tests replace the SDK and do not update any live account.
- TimeFormatProvider tests exercise saved 12-hour hydration, default 24-hour startup, no write during restore, ordered rapid toggles, remount persistence and read/write-failure recovery. Formatter tests cover midnight/noon/PM/date-time/invalid values. Native-field bridge tests check formatted labels, Android is24Hour and iOS spinner locale. Duration counters/axes remain durations.
- Android/iOS/web exports passed in `.expo/ux-settings-journal-verification`, with Metro selecting src/app/. Web remains a mobile-only notice without native SQLite/WASM initialization. Consulted SDK 57 SQLite/storage/picker docs, RN 0.86 Alert/Modal docs and installed Appwrite 2.0 Account.updateName typings. Native picker gestures/locale rendering, keyboard behavior, Alert interaction, profile API calls and device scrolling still need physical-device checks.
- All pre-existing work, including screens/AuthScreen.js, was preserved. No device database was reset, no live profile was edited, and no project files were deleted. CHANGELOG.md contains the complete current-pass file summary.

## List Performance, Six-Month Demo, Chart Axis, and Coach (2026-10-27)

- `npx.cmd expo lint` and `npx.cmd tsc --noEmit`: passed with no errors or warnings. No dependency, schema, routing, theme or backup-format changes were needed.
- Ten suites: **174 cases, 173 passed, 0 failed, 1 existing New York-specific skip** in Asia/Singapore. Command: `node --experimental-vm-modules --test tests/database.test.cjs tests/backup.test.cjs tests/task-library.test.cjs tests/material-files.test.cjs tests/notifications.test.cjs tests/subject-deletion.test.cjs tests/focus-timer.test.cjs tests/auth.test.cjs tests/theme.test.cjs tests/web-platform.test.cjs`.
- Separate `TZ=America/New_York` database run: **68 passed, 0 failed/skipped**, including DST regressions. Production SQLite checks cover latest owned completion across all dates, actual/fallback completion ordering, future-completion exclusion, ID ties, bound account input and invalid reference times. Coach tests cover each rule, priority, deterministic postponed-task selection, empty/legacy history, exactly 72 hours, exactly 240 minutes and exactly 1.5x actual work versus their strict warning thresholds.
- Expanded seed checks verify six-calendar-month month-end clamping (May 31 -> preceding November 30), 20 unique subjects/five fields, 40 unique task titles, all 40 assignments represented in history, at least 280 completed blocks, unique reflection notes and journal titles/content, varied over/underruns, correct work/break arithmetic, no future actual completions, account isolation, repeatability and rollback. Existing midnight/DST tests retain exactly 240 planned minutes today and require explicit override for additional work.
- Actual-component bridge tests verify one Coach note at a time, hide-on-no-match, Home data wiring, completion-only late/on-time text, no lateness in live ticks, preserved work/break/foreground behavior, memoized row wiring, stable Journal/Library render callbacks across clock ticks and unchanged static Home row props until readiness changes. The Library still opens subject notebooks and prefills shelf-specific additions after replacing its vertical ScrollView with field-list virtualization.
- Axis tests verify 0/60/120/... ticks, larger whole-hour steps for extreme days, at most six intervals, a nonzero one-hour all-zero range, hour/minute labels and unchanged point values. Existing enlarged touch targets, day/week details and both-theme chart tests remain passing. Implementation was checked against installed Chart Kit 7.0.4's root LineChart/AbstractChart source and typings.
- Android and iOS exports passed using `npx.cmd expo export --platform android --platform ios --output-dir .expo/coach-performance-verification`; Metro selected src/app/. Bundles verify compilation/assets, not native scrolling, clipping, animations or frame performance. Manually test rapid Journal/shelf scrolling, large accessibility text and reveal/close gestures on a physical device; no device profiling was performed here.
- Consulted [Expo SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/) and [React Native FlatList configuration guidance](https://reactnative.dev/docs/0.86/optimizing-flatlist-configuration) before the UI changes. Source/history archives and any device database were untouched. Pre-existing local work, including screens/AuthScreen.js, was preserved. The complete current-pass file summary is in CHANGELOG.md.

## Light Startup, Compact Actions, Permanent Files, and Study Journal (2026-10-27)

- Ran `npx.cmd expo install expo-document-picker`: already SDK-compatible at ~57.0.3; no dependency/lockfile delta. Used SDK 57 File/Directory/Paths.document APIs (the current documentDirectory equivalent), awaiting copy/create/delete operations.
- `npx.cmd expo lint`, `npx.cmd tsc --noEmit`, `npx.cmd expo install --check`: passed.
- Ten regression suites: **167 cases, 166 passed, 0 failed, 1 existing NY-specific skip** in Asia/Singapore. Command: `node --experimental-vm-modules --test tests/database.test.cjs tests/backup.test.cjs tests/task-library.test.cjs tests/material-files.test.cjs tests/notifications.test.cjs tests/subject-deletion.test.cjs tests/focus-timer.test.cjs tests/auth.test.cjs tests/theme.test.cjs tests/web-platform.test.cjs`. The final Android menu-dismissal and enlarged-target checks were also rerun through the component suite.
- Database suite in America/New_York: **64 passed, 0 failed/skipped**. Added owned manual-journal creation and mixed-feed ordering/key/isolation checks, manual-note survival after subject deletion, persistent local_file_path behavior, and three-calendar-month seed checks including May-31 clamping, over/underruns, timer arithmetic, no future actual completions and preserved other-account entries. Existing midnight/DST/240-minute/recommitment/migration checks remain passing.
- New material-files suite executes the actual picker/copy helper with filesystem/provider transports replaced: private permanent destinations, cache independence, cancellation, partial-copy rollback, scoped pending cleanup and provider/other-account file preservation. UI tests cover file-picker draft autofill/saving/cleanup, manual-entry failure/retry/duplicate guards, unified Journal rendering, Settings OFF=Light/ON=Dark, no redundant Settings help, iOS menu dismissal ordering, Android post-commit handoff and 44px SVG point dispatch.
- Theme tests now verify old bare dark/light values reset to Light, malformed/unsupported/missing/read-failed preferences fall back safely, version-2 Dark restoration and serialized writes. Root checks verify the cream startup while fonts load. The native default is also Light in app.json.
- Backup version 6 tests verify owned manual-entry round trips, file-URI preservation, missing/invalid journal collection rejection without replacement, versions 1-5 defaults and other-account preservation. Existing timer/history/ID-remapping/rollback validation still passes. File bytes remain outside JSON.
- Android/iOS/web exports passed in `.expo/journal-files-verification`, selecting src/app/ and journal.tsx. Web output has no WASM assets or SQLite loader signatures. Native picker interaction, external file handlers/permissions, menu gestures, chart touch accuracy and visual/accessibility scaling still require a physical device; tests substitute native bridges and exports verify compilation/assets.
- A pre-existing local edit to screens/AuthScreen.js was preserved. New schema creation is additive; old reflection records remain intact. Existing saved files/provider originals are not removed by pending-copy cleanup or demo resets.

## Reflection Journal, Materials, Descriptions, and Interactive Progress (2026-10-27)

- Parts 1/2 were implemented and checked before Parts 3/4: real-auth demo loading, vibrant books, warm auth heading, described tasks and owned material CRUD/opening. Existing Light fallback, global toast and themed info behavior were verified and preserved.
- `npx.cmd expo lint`, `npx.cmd tsc --noEmit`, and `npx.cmd expo install --check`: passed. No dependency or native-config changes were needed.
- Nine suites: **156 cases, 155 passed, 0 failed, 1 existing NY-specific skip** in Asia/Singapore. Command: `node --experimental-vm-modules --test tests/database.test.cjs tests/backup.test.cjs tests/task-library.test.cjs tests/notifications.test.cjs tests/subject-deletion.test.cjs tests/focus-timer.test.cjs tests/auth.test.cjs tests/theme.test.cjs tests/web-platform.test.cjs`. Removed interval/rating tests were replaced with reflection ownership, persistence and migration behavior because spaced repetition was retired.
- Database suite with `TZ=America/New_York`: **61 passed, 0 failed/skipped**. Production SQL verifies nullable description create/edit/clear/omitted-update preservation; owned material CRUD, URL/path normalization and cascades; completed-session reflection validation, chronological reads, task-delete SET NULL behavior; and day detail totals/work/break/elapsed/overrun matching weekly progress. A migration failure injected after legacy review-copy/drop rolls back to the original table/data; retry preserves topic IDs, notes, subjects and dates. Existing timer/DST/240-minute/recommitment and cross-account checks remain passing.
- Backup tests cover version-5 description/linked-reflection round trips and ID mapping, malformed fields/links/timestamps without replacement, and versions 1-4 conversion to standalone notes. Existing attachment metadata, timer state, history/count preservation, other-account isolation and transaction rollback coverage remain.
- Actual-component bridge tests cover real-auth demo loading/visibility, notebook descriptions, material draft failure/retry/link errors/edit/delete confirmation, point-vs-background dispatch, weekly summaries, daily detail errors/overruns, the durable completion-to-reflection flow, skip/duplicate-submit/failure behavior and subject-grouped journal sections. Existing toast tests now use Reflection saved and the Reflections route; Settings suppression, expiry and dialog coverage remain passing.
- `npx.cmd expo export --platform android --platform ios --platform web --output-dir .expo/reflection-overhaul-verification`: passed using src/app/. The old review route is replaced by reflections.tsx. Exported web output contains no WASM assets or SQLite loader signatures; browser still shows the mobile-only notice.
- `git diff --check`: passed. Physical-device chart touch dispatch/appearance, nested info dialogs, keyboard/large-text behavior, file permissions/OS handlers and live Appwrite login still need manual checks. The tests substitute native UI/linking/animation bridges; bundle exports do not establish those interactions. File links reference existing device locations; no upload or file-copy implementation is present.

## Global success toasts, Title Case and themed information dialogs (2026-10-27)

- `npx.cmd expo lint` and `npx.cmd tsc --noEmit`: passed. The tab-bar host uses `BottomTabBar` and its types from `expo-router/js-tabs`, matching SDK 57's navigation context. The dialog uses RN 0.86's StyleSheet.absoluteFill.
- Nine regression suites: 151 cases, 150 passed, 0 failed, 1 existing New York-only DST case skipped in Asia/Singapore. Command: `node --experimental-vm-modules --test tests/database.test.cjs tests/backup.test.cjs tests/task-library.test.cjs tests/subject-deletion.test.cjs tests/focus-timer.test.cjs tests/auth.test.cjs tests/theme.test.cjs tests/web-platform.test.cjs tests/notifications.test.cjs`.
- New actual-component checks use a controlled clock to exercise slide animation, exact three-second expiry, repeated identical notices, hidden expiry and unmount cleanup. Host checks cover tab-bar placement wiring, existing/new Settings-message discard, no replay, keyboard/sheet hiding and listener cleanup. Feedback/workspace checks verify inline errors without success cards and fresh notice identities.
- Dialog checks exercise InfoButton opening/closing without Alert.alert; actual InfoModal uses theme colors and Merriweather/Inter fonts, scrollable content and native Back/backdrop/close/OK dismissal. Existing editor/deletion/notebook/web tests now use Title Case labels. The final hidden-expiry refinement was rechecked with all five notification tests plus lint/typecheck.
- `npx.cmd expo export --platform android --platform ios --platform web --output-dir .expo/notifications-verification`: passed for final source using src/app/. No dependencies, SQLite services/schema, backup format or authentication logic changed.
- Native toast alignment/motion, platform accessibility announcements/focus, large text/long guidance, nested sheet dialogs and keyboard behavior still require physical-device checks. Native component/animation bridges are substituted in the tests; bundling does not establish their rendered appearance.

## Weekly Progress chart and completed demo history (2026-10-27)

- Installed with `npx.cmd expo install react-native-svg react-native-chart-kit`: SDK-compatible SVG 15.15.4 and Chart Kit 7.0.4. `npx.cmd expo install --check` reports dependencies up to date.
- `npx.cmd expo lint` and `npx.cmd tsc --noEmit`: passed.
- All eight regression suites: 144 cases, 143 passed, 0 failed, 1 New York-specific DST case skipped in Asia/Singapore. Command: `node --experimental-vm-modules --test tests/database.test.cjs tests/backup.test.cjs tests/task-library.test.cjs tests/subject-deletion.test.cjs tests/focus-timer.test.cjs tests/auth.test.cjs tests/theme.test.cjs tests/web-platform.test.cjs`.
- Database suite under `TZ=America/New_York`: 64 passed, 0 failed/skipped. New production-SQL checks cover seven zero-filled buckets, year/leap boundaries, invalid input, account isolation, timed actual/zero work versus legacy duration, exact local-midnight completion boundaries, actual versus planned completion dates, excluded unfinished/missed sessions and DST elapsed minutes. The timer lifecycle test verifies 25 actual minutes after a two-minute break reaches weekly progress. Repeated demo reset and all-times/DST fixtures verify six historical totals while today's workload remains 240 minutes.
- Actual-component bridge tests verify measured/resized chart width, seven values including zeros, all-zero y-axis bounds, point inspection, theme-aware chart colors, loading/error feedback, and Home placement/data wiring. Native chart rendering is substituted by a bridge; these checks do not establish its rendered appearance.
- `npx.cmd expo export --platform android --platform ios --platform web --output-dir .expo/weekly-progress-verification`: passed using src/app/. Web remains the mobile-only notice; exported web output contains no WASM assets or SQLite loader signatures.
- No SQLite schema, backup version, authentication or scheduling-modal changes. Check native SVG chart appearance, narrow/rotated layouts, accessibility text scaling, point targets, account changes, completion/import refresh and both themes on a physical device using DEMO_AND_TESTING.md.

## Light fallback, consistent type scale, reversible books and field autocomplete (2026-10-27)

- `npx.cmd expo lint` and `npx.cmd tsc --noEmit`: passed.
- All eight regression suites: 139 cases, 138 passed, 0 failed, 1 timezone-specific DST skip. Command: `node --experimental-vm-modules --test tests/database.test.cjs tests/backup.test.cjs tests/task-library.test.cjs tests/subject-deletion.test.cjs tests/focus-timer.test.cjs tests/auth.test.cjs tests/theme.test.cjs tests/web-platform.test.cjs`.
- Theme tests verify Light fallback for missing/invalid/unreadable preferences without overwriting storage, explicit saved Dark restoration, serialized toggles and write-error recovery.
- Actual-component tests hold animations before completion to verify covers remain mounted on Close, hidden controls become inaccessible, the reverse targets the same Animated.Value, rapid reopening stops/reverses the previous animation, and reduced motion avoids tweening. Dark gradients are checked for reduced luminance, restored Light colors, and unchanged subject metadata.
- Shelf/entry tests verify field + callbacks, initialField plumbing/reset, case-insensitive option deduplication, filtered/show-all suggestions, existing/custom-field saves and retained drafts on failure. Existing confirmation tests now provide the editor's memo hook bridge.
- All active app/component/screen/tab fontSize and lineHeight declarations use the shared scale/leading tokens; the completion-to-review sheet now participates too. Native accessibility scaling and rotated-code fitting remain enabled.
- `npx.cmd expo export --platform android --platform ios --platform web --output-dir .expo/shelf-polish-verification`: passed, using src/app/. No dependencies or storage-schema changes were needed.
- Physical-device motion quality, contrast, OS text scaling, keyboard/dropdown touch handling and native picker/share/Alert behavior remain manual checks in DEMO_AND_TESTING.md. Bridge tests and bundle exports do not establish their rendered appearance.

## Academic journal theme and dedicated subject notebooks (2026-10-26)

- Installed `expo-font @expo-google-fonts/merriweather @expo-google-fonts/inter` with `npx.cmd expo install`. Existing expo-font remains ~57.0.4; both Google font packages are ^0.4.2. Only six chosen font faces are imported by weight subpath and loaded locally in App.js.
- `npx.cmd expo lint`, `npx.cmd tsc --noEmit`, and `npx.cmd expo install --check`: passed.
- All eight suites: 134 cases, 133 passed, 0 failed, 1 New York-specific DST case skipped in Asia/Singapore. Run `node --experimental-vm-modules --test tests/database.test.cjs tests/backup.test.cjs tests/task-library.test.cjs tests/subject-deletion.test.cjs tests/focus-timer.test.cjs tests/auth.test.cjs tests/theme.test.cjs tests/web-platform.test.cjs`.
- Component tests verify Library has no task list/New Task/reset action; cover navigation uses the correct route ID; Opened Book scopes tasks, preselects New Task, exposes Edit/Delete, and redirects missing/unowned/invalid IDs. Missed-badge rules are tested in their new book location. Shared mutation tests cover quiet Subject saves, retained backup feedback, and confirmed/guarded book deletion with refresh.
- Root tests verify waiting for six font faces, recovery after a font error, and preserved web/native route mounting. Existing theme restoration, timers, authentication, backup and production-SQL lifecycle regressions remain passing.
- `npx.cmd expo export --platform android --platform ios --platform web --output-dir .expo/journal-verification`: passed using src/app/. Assets include the selected Merriweather/Inter faces; the active Library is now a nested stack. Web remains a mobile-only notice, with SQLite excluded.
- No schema, study-data service, backup-format or authentication changes. New source files: typography, Opened Book and three Library route wrappers. The old flat library.tsx route wrapper was replaced. Native back gestures, rendered font metrics, offline loading, keyboard sheets, accessible text scaling, notepad appearance and native Alert/share/picker interactions still require device checks; exports and bridge tests do not establish their visual behavior.

## Subject-code spines, animated covers, and typed durations (2026-10-26)

- `npx.cmd expo lint` and `npx.cmd tsc --noEmit`: passed.
- All eight test suites: 129 cases total, 128 passed, 0 failed, 1 New York-specific DST case skipped in Asia/Singapore. Command: `node --experimental-vm-modules --test tests/database.test.cjs tests/backup.test.cjs tests/task-library.test.cjs tests/subject-deletion.test.cjs tests/focus-timer.test.cjs tests/auth.test.cjs tests/theme.test.cjs tests/web-platform.test.cjs`.
- Database suite with `TZ=America/New_York`: 61 passed, 0 failed/skipped. Coverage includes strict duration parsing, overnight/DST elapsed addition, a typed 270-minute SQLite workload warning/override, normalized owned subject-code creation/editing, omitted-code update preservation, and migration/reopening with GEN-101 and linked records intact.
- Backup tests verify version-4 code/field round trips, invalid-code rejection without replacement, version-1/2 defaults, and version-3 paused/completed timer preservation with default codes.
- Actual-component bridge tests verify code prefill/save; code-only spines; separate reveal/filter/edit/return/reset callbacks and selected state; duration-to-End updates; Start changes; End override; invalid keyboard submission; frozen workload confirmation; and reschedule options. These tests substitute native UI/animation bridges and do not verify rendered animation smoothness.
- `npx.cmd expo export --platform android --platform ios --output-dir .expo/bookshelf-duration-verification`: passed, using `src/app/` routes. No dependency/config changes were required; animations use standard React Native Animated.
- Verify the shelf animation, long/scaled titles and codes, narrow devices, reduced-motion settings, keyboard/picker interaction, and native share/import on a physical device using DEMO_AND_TESTING.md. Bundle exports confirm compilation/assets, not these native interactions.

## Task editing/deletion and Library missed badge (2026-10-26)

- `npx.cmd expo lint` and `npx.cmd tsc --noEmit`: passed.
- `node --experimental-vm-modules --test tests/database.test.cjs tests/task-library.test.cjs tests/subject-deletion.test.cjs tests/backup.test.cjs tests/focus-timer.test.cjs tests/theme.test.cjs tests/auth.test.cjs tests/web-platform.test.cjs`: 122 total, 121 passed, 0 failed, 1 timezone-specific DST case skipped in Asia/Singapore.
- Production SQLite tests cover bound/owned task updates, invalid IDs/fields, cross-account rejection, preservation of task metadata/history, cascade deletion/rollback, kept review topics/material notes, and all-date session summaries independent of Home's day query.
- Actual-component bridge tests verify prefilled edit fields, failure drafts/retry, deletion Cancel/dismiss, duplicate confirmation guards, competing edit exclusion, deletion refresh/error feedback, Library badge suppression for a next-week commitment, and card actions/badge visibility. Existing subject tests now expose the newly imported updateTask mock.
- No dependency or schema changes. Native Alert gestures, keyboard, theme rendering, and cross-tab behavior still need the manual checks in DEMO_AND_TESTING.md. Native exports were not rerun for this pass.

## Swatches, appearance controls, motto, and web guard (2026-10-24)

- `npx.cmd expo lint` and `npx.cmd tsc --noEmit`: passed.
- `node --experimental-vm-modules --test tests/web-platform.test.cjs tests/database.test.cjs tests/subject-deletion.test.cjs`: 60 total, 59 passed, 0 failed, 1 timezone-specific DST check skipped.
- New web tests verify that the browser database imports no native/WASM dependencies, rejects unsupported storage, and validates account IDs. Root-component checks confirm the web notice renders before sessions/routes mount while Android/iOS retain the existing session/route tree.
- `npx.cmd expo export --platform web --output-dir .expo/web-guard-verification`: passed, active routes `src/app/`. The output contains no `.wasm` assets or `sqlite3.wasm`, `wa-sqlite`, or `ExpoSQLite` loader signatures.
- `git diff --check`: passed. No dependency or native schema changes. Existing native database/timer work was preserved.
- Tests and bundling do not verify visual rendering. Check circle visibility (especially Black/White), switch appearance, Home footer, and the browser notice manually; browser study storage remains intentionally unavailable.

## Commitment Focus Timer (2026-10-22)

| Check | Result |
| --- | --- |
| `npx.cmd expo lint` | Passed |
| `npx.cmd tsc --noEmit` | Passed |
| Combined database/auth/backup/theme/subject-deletion/focus-timer suites | 111 tests: 110 passed, 0 failed, 1 NY-only DST case skipped in Asia/Singapore |
| Database suite with `TZ=America/New_York` | 54 passed, 0 failed, 0 skipped |
| Android/iOS native bundle export | Passed; `.expo/focus-verification`, active routes `src/app/` |
| `git diff --check` | Passed |

Production SQL verifies start/break/resume/finish transitions, precise short-break accumulation, finishing during a break, lateness, frozen completion totals, duplicate retries, one active session per account, ownership/state checks, transaction rollback, and reopen restoration during work and breaks. Migration tests verify null/zero defaults for old rows. Active sessions remain reachable on later date queries, are excluded from missed detection, and retain planned workload. The existing full academic-loop test now starts, pauses, resumes and finishes a timer before creating/rating its subject-linked review and testing subsequent recommitments.

Backup tests cover version-3 active/open-break and completed-time round trips, versions 1/2 defaults, invalid timer state/totals, multiple-active rejection, and unchanged existing records on invalid import. Actual FocusTimer component tests substitute native bridges to check ticking, full/subminute/no lateness, frozen work, pause/resume/finish wiring, foreground catch-up, background interval cleanup, and action-specific loading feedback. The final subminute-lateness addition was checked by the focused component suite, lint/typecheck, and both native exports after the full regression run.

No dependency changes were needed. Bundle exports verify compilation, not physical device rendering or OS process behavior. Check both themes, actual cold restarts/backgrounding, native gestures and the Finish Session review prompt on a device using `DEMO_AND_TESTING.md`. Timer mode intentionally continues while away; there is no background JS service, automatic pause, notification, or automatic finish.

## Subject deletion (2026-10-22)

- `npx.cmd expo lint` and `npx.cmd tsc --noEmit`: passed.
- `node --experimental-vm-modules --test tests/database.test.cjs tests/subject-deletion.test.cjs`: 52 tests total, 51 passed, 0 failed, 1 timezone-specific DST case skipped in Asia/Singapore.
- Production-SQL coverage confirms deletion of an owned subject and its tasks, original/replacement study blocks, reviews and materials; unrelated subjects/accounts remain unchanged. Invalid/unowned IDs reject without writes, and an injected cascade failure rolls back the parent and dependent deletions.
- New EntrySheet tests compile the actual component and substitute native UI/storage bridges to exercise edit-only visibility, exact confirmation text, Cancel/dismiss no-ops, duplicate-tap prevention, save/delete exclusion, success callbacks, and retained draft/retry behavior after failure.
- `git diff --check`: passed. No dependency/schema changes. Native Alert gestures/colors, keyboard interaction, post-delete tab refresh, and selected-filter clearing still need the device checks in `DEMO_AND_TESTING.md`. Native exports and unrelated suites were not rerun; their earlier evidence below remains historical.

## Subject editing and Show All Tasks (2026-10-22)

- `npx.cmd expo lint` and `npx.cmd tsc --noEmit`: passed.
- `node --experimental-vm-modules --test tests/database.test.cjs`: 47 tests total, 46 passed, 0 failed, 1 timezone-specific DST case skipped in Asia/Singapore.
- New production-SQL tests verify metadata normalization, in-place updates, unchanged-save behavior, joined Task/Review/StudyBlock names/colors, retained Material relationships, bound SQL-like text, invalid input rejection, and ownership isolation without modifying existing rows on failure.
- `git diff --check`: passed. No schema or dependency changes were required. Earlier full-suite/native-export results below are historical; they were not rerun for this pass.
- Native pencil tapping, sheet prefill/cancel/save, legacy swatches, keyboard behavior, and post-save shelf movement still require the updated device checks in `DEMO_AND_TESTING.md`.

## Fields of study, gradient shelves, and theme persistence (2026-10-22)

| Check | Result |
| --- | --- |
| `npx.cmd expo lint` | Passed |
| `npx.cmd tsc --noEmit` | Passed |
| `npx.cmd expo install --check` | Dependencies are up to date |
| Combined database/auth/backup/theme tests | 96 total: 95 passed, 0 failed, 1 New York-specific DST check skipped in Asia/Singapore |
| Database tests with `TZ=America/New_York` | 45 passed, 0 failed, 0 skipped |
| Android/iOS native bundle export | Passed; `.expo/fields-verification`, active routes `src/app/` |
| `git diff --check` | Passed |

New coverage exercises actual provider hydration and ordered storage writes with isolated hook/native/storage hosts, missing/invalid/read/write failure recovery, and preference restoration after remount. Production SQL tests cover field metadata validation, derived colors in Task/StudyBlock/Review, legacy subject IDs/colors/dependencies through migration/reopen, and version-2 backup round trips plus version-1 conversion without harming existing records on invalid imports. The scheduling/review/backup/authentication regression suites remain passing.

Bundle exports verify module resolution and compilation, not native visual rendering. Manually verify both-theme gradient books, full/scaled titles, shelf swiping, keyboard behavior for the new field input, and persisted theme on a real cold restart. Existing custom development clients need rebuilding to include newly added native modules; matching Expo Go includes AsyncStorage and LinearGradient per the SDK 57 docs.

## Subject palette and Review UI tuning (2026-10-22)

- `npx.cmd expo lint`: passed.
- `npx.cmd tsc --noEmit`: passed.
- `git diff --check`: passed (only Git's LF/CRLF normalization notices).
- Source inspection confirms ten distinct named dark-mode choices, a hidden light-mode color chooser, and monochrome light-mode book faces, outlines, text/icons, and paper edges. Existing markers/pills use ThemeContext's monochrome mapping.
- Source search confirms no review interval constants, interval guidance, or next-review confirmation strings remain in screens/components. ReviewService and its scheduling rules were not changed; successful ratings still refresh the queue.
- Native appearance and screen-reader behavior still require the updated manual checks in `DEMO_AND_TESTING.md` on a device. Database tests and native bundle exports were not rerun for this presentation-only pass; earlier results below remain historical.

## Original handoff baseline

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

## Native calendar and compact help checks (2026-10-22, Asia/Singapore)

Installed picker 9.1.0 with Expo and verified its API against SDK 57's versioned reference and the library's version-9.1.0 docs/types. The current scheduler keeps full Date instances and does not parse formatted labels or relative day toggles.

| Check | Result |
| --- | --- |
| `npx.cmd expo lint` | Passed |
| `npx.cmd tsc --noEmit` | Passed |
| Combined auth/database/backup suites, `TZ=Asia/Singapore` | 90 cases: 89 passed, 0 failed, 1 New York DST-only skip |
| Database suite, `TZ=America/New_York` | All 44 passed, including repeated-hour/calendar-edit coverage |
| `npx.cmd expo install --check` | Dependencies are up to date |
| Android/iOS export to `.expo/calendar-verification` | Both passed; Router selected `src/app/`; Ionicons assets resolved |

Regression coverage includes today at 5 PM when now is 4 PM, tomorrow morning despite an earlier wall-clock hour, next week, year boundaries, explicit past rejection, equal/reversed endpoints, picker calendar/clock merge semantics, nonmutation of the input window, duration preservation, a selected date surviving a later midnight, stale warning timestamps, next-week 240/241-minute totals, future overnight splits, account isolation, rescheduling counts, and native DST instants.

Picker cancellation/error handling and info alerts were inspected in code. Native calendar/clock gestures, iOS compact popovers, Android dialog cancellation, popup appearance, long-title scaling and tactile styling have not been exercised on a physical device/simulator here. Follow [DEMO_AND_TESTING.md](DEMO_AND_TESTING.md) for those checks and rebuild an existing custom development client for the added native module. Existing SQLite services/schema and auth behavior remain unchanged.
