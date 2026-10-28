# Context for a New Session

Copy this block, then append the next task.

```text
Continue Yotei in C:\Users\Dawn-BYTES\Documents\Yotei-Engine\yotei.
Read AGENTS.md, README.md, PROJECT_CONTEXT.md and VALIDATION.md. Inspect git
status and preserve local/untracked work. Active routes are src/app/, not the
preserved root app/index.tsx experiment. main=index.js loads the URL polyfill
before expo-router/entry. App.js owns providers and six local Merriweather/Inter
faces plus a TimeFormatProvider around Application. Expo ~57.0.31, RN 0.86.3, React 19.2.3, npm, JS/JSDoc/checkJs and TSX routes.
Use npx expo install, matching versioned docs, and expo-router entry points.

Tabs: Home, Library (nested /library/[subjectId] notebooks), Journal, Settings.
JournalScreen and journal.tsx replace ReflectionsScreen/reflections.tsx. The
ReflectionItem table/service and CompletionReflectionSheet remain: focus-session
notes now share one newest-first timeline with manual JournalEntry notes.

JournalEntry columns: id, user_id, title, content, created_at. JournalService
creates/reads owned entries and returns an owned UNION ALL timeline combining
manual entries and reflections. IDs are entry-<id>/reflection-<id> to avoid key
collisions. Title 1-200 characters; content 1-12000. New Entry opens a keyboard-aware
JournalEntrySheet with shared workspace locks, draft-preserving errors and global
success toast. Tap a preview for full text in JournalDetailSheet. updateJournalEntry/
deleteJournalEntry accept numeric source_id and kind=entry|reflection. Manual titles/
content and reflection note text are editable; dates/session links stay unchanged.
Delete removes only the note. Manual entries survive subject deletion.
Focus completion persists done before the optional reflection note; failures and
Skip never undo done status. Reflections validate the owned completed session and
subject; deleted blocks detach the note's session link rather than deleting it.

Theme: Light cream #F8F6F2 / white / #1F1F1F / forest #2D5A41; Dark #121412 /
#1C201D / #F0F0F0 / #7CB58F. Merriweather headings, Inter body, shared size scale,
20px screen padding and bordered/shadowed cards. ThemeContext starts isDark=false.
The Settings switch is value=isDark (OFF=Light, ON=Dark), correcting the old reversed
switch. AsyncStorage yotei.theme now holds version-2 JSON {version:2,mode:"dark"|
"light"}. Legacy bare strings reset to Light; new explicit Dark choices persist
through serialized writes. App.js shows a cream StartupScreen while fonts/theme
hydrate; app.json starts Light. Settings restores Data Management JSON-backup help
but keeps mode/general headers free of redundant info icons. Complex workload
rules still use themed InfoModal. Static headings/labels use Title Case; preserve
user text and sentence casing. Home footer: By students, for students.

Both book themes keep identical vibrant field gradients, code-only spines and
animated covers with readable themed paper/ink. Shelf + prefills the field;
existing/custom field dropdowns, subject codes, edit/delete, reduced motion and
reversible animations remain. Task descriptions are optional nullable TEXT (max
4000); omitted updates preserve them; explicit empty input clears. Notebook cards
show them. Task/material Edit/Delete now live behind ItemActionsMenu's kebab.
It uses themed options and waits for native dismissal on iOS before opening an
editor/confirmation; Android runs after commit. No inline Edit/Delete buttons.

MaterialSheet prioritizes Browse File Manager. DocumentPicker copies its selection
into cache, then utils/materialFiles.js uses SDK 57 File/Directory/Paths.document
to copy into private materials/user-<encoded-id>/ storage. Persist the permanent
URI in Material.local_file_path with null url_or_note. Manual URL/path input is a
secondary optional choice. Unsaved newly picked copies are cleaned on cancel,
replacement or unmount; provider originals and saved files are never cleaned up
by that path. Files survive cache cleanup/restarts, but are lost if app data is
removed. OS opening still needs a suitable handler/permissions. File contents are
not embedded in JSON backups. expo-document-picker is already ~57.0.3 and was
rechecked with the Expo installer; do not add a duplicate legacy FileSystem API.

WeeklyProgressCard uses root LineChart from Chart Kit 7.0.4 + SVG 15.15.4. Dots
are 7px with transparent 22px-radius touch circles. A point must open the day and
suppress the background summary. Background/summary rows remain accessible.
utils/progressChart.js configures clean whole-hour Y ticks with at most six
intervals, rounding up the ceiling (all-zero week: 0 to 1h). Data values stay real.
ProgressService counts done sessions on seven LOCAL completion dates, including
zeros. Actual studied seconds exclude breaks; untimed legacy completions fall back
to scheduled duration. Overnight completions credit the whole completion date.
Daily details show Scheduled / Actual / Overrun. Actual is elapsed work+breaks;
overrun=max(0, elapsed-planned). finished_late_minutes is separate clock lateness,
so late starts cannot produce inconsistent arithmetic. The planned-workload
240-minute guardrail is separate from completed minutes.

Scheduler uses native full Start/End dates and optional duration text (4h 30m).
Expired unstarted scheduled blocks become missed. Rescheduling preserves history;
a unique direct-replacement index and INSERT trigger increment postpone_count once.
Home Coach priority is now overdue incomplete tasks, postpone_count>=2, planned
workload>240, completed today AND yesterday, then optional best-hour suggestion.
Date-only deadlines expire after the local due date; done tasks do not trigger it.
CoachService returns local streak flags plus the most-studied hour after >=3
positive-work completions in that hour. Small UTC-minute SQL aggregates convert to
local hours in JS (not SQLite localtime) for DST/fractional offsets/host consistency.
useDashboardData exposes coach, replacing unused lastCompleted hook state. Old
72-hour and last-session-overrun rules are superseded. Clock suggestions use the
saved time format. Notebook five-minute task coaching remains. One active timer per user,
precise work/break timestamps,
resume/finish and restoration beyond midnight/end remain. Background work/break mode
continues; active blocks never auto-miss. Live FocusTimer no longer calculates or
shows lateness. CompletionReflectionSheet uses getCompletionStartMessage against
saved timestamps: exact, subminute, whole-minute late/early or neutral legacy text.
Home/Journal/Library FlatLists use 10 initial +10 per batch, windowSize5 and
removeClippedSubviews=true, memoized rows and useCallback renderers. Library now
virtualizes field shelves vertically; each shelf keeps horizontal books. Journal
rows do not read workspace context; static FocusCard uses narrow props instead of
the clock context. Workspace entry/edit/reschedule/timer callbacks are stable.

Demo reset replaces only the signed-in Mock account in one
transaction. The loader is now strictly Mock-only (USE_REAL_AUTH===false) in both
Settings rendering and the action guard. Real auth stays enabled in auth/index.js;
explicitly switch/reload for the built-in demo. Six calendar months of local dates, month-end clamping, older rest
days and a populated recent week: 20 distinct subjects in five fields (four each),
40 uniquely titled described tasks, 40 materials, hundreds of completed sessions
with varied over/underruns/breaks/lateness. All tasks appear in session history.
Reflections and manual entries (roughly every two days) have unique text composed
from varied experiences, next steps and concrete assignment/date/timing details. Four blocks retain today's 240 planned
minutes. The first uses honest elapsed completion (zero exactly at midnight).
Counts are date-dependent and returned by seedDemoData. Other accounts/auth remain.

Scheduled Home cards now have ONE primary Start Session button. Mark as Done and
Delete Block are in the top-right ItemActionsMenu beside the time/status. Its custom
actions array supports label/onPress/tone; legacy Edit/Delete callbacks and optional
custom labels still work. Action callbacks wait for iOS dismissal or Android commit
before opening another modal. The old three-button row/styles/canStart prop are gone.
Start stays disabled before its window/during mutations, but remains clickable with
an active session. controlTimer posts the exact notice "You already have a session
in progress. Finish it before starting a new one." and returns before SQLite for
start attempts when any owned block is active (including paused). Break/resume work.
BlockDeletionModal replaces native Alert ONLY for scheduled block deletion. It uses
themed surfaces/Merriweather/Inter, Cancel/Delete Block, protected backdrop/Back/
accessibility cancellation and retained errors for retry. Workspace locks competing
actions; duplicate confirms and dismissal while deleting are blocked. Other record
confirmations still use native Alert.

Scheduled Home blocks have Mark as Done and confirmed Delete Block. Manual done
stores actual_start_time=null, actual_end_time=now, zero breaks and scheduled
seconds in actual_study_seconds. No invented start. Retries keep the first result;
active/missed blocks reject. Progress credits the completion day, backups validate
this state and optional reflection still opens. Delete preserves Task/other blocks.

TimeFormatContext stores yotei.time-format.v1=12|24, default24, with ordered writes
and hydration before screens. useTimeFormat wraps shared utils/timeFormat.js;
schedules, logs, journal and best-hour labels use it. Elapsed counters/Y study-hour
axes are durations. Android passes is24Hour; iOS uses formatted button + native
spinner with en-GB/en-US locale (compact date picker stays). No new dependencies.

Both auth adapters now updateName(name); SessionContext immediately updates the
normalized profile on success, retaining user.id and excluding sign-out races.
Mock persists only public session/name data without changing Remember Me. SQLite
has no profile-name/session table; study ownership stays by the same user_id.
Settings opens the keyboard-aware DisplayNameSheet with draft-preserving errors.
New Subject Code drafts are empty with e.g. GEN-101 placeholder; editing and legacy
migration keep saved codes. Duration edits always derive End from selected Start.

Six tables: Subject, Task, StudyBlock, ReflectionItem, Material, JournalEntry.
Backup exports version 6 and imports 1-6. Required arrays: subjects, tasks,
studyBlocks, reflectionItems, materials, journalEntries. Import validates first,
replaces only current account atomically, remaps IDs and attaches history by UPDATE
so postpone counts are not inflated. Versions 1-4 convert old review topics into
notes; pre-v6 journalEntries default empty. Keep timer/field/code defaults and
20 MB limit. Exclude passwords, sessions, theme choice and file bytes; include
permanent file URIs as references. Import refreshes/reset drafts via demoRevision.

StudyWorkspace/useDashboardData share data/actions across tabs. Toast.js and
ToastTabBar show success above the actual tab bar for 3s, with fresh noticeId for
identical messages. Settings hides/discards all successes; keyboard/sheets hide
without extending expiry. Inline Feedback only shows errors. Native alerts remain
for destructive confirmation; InfoButton uses the themed rich-child InfoModal.

Authentication stays adapter-based ({id,name,email}), currently Appwrite. Mock
student@yotei.demo / study12345 is separate. Remember Me defaults off, cold-boot
cleanup and public diagnostic logging remain. Local study data is not cloud sync.
Browser deliberately shows a mobile-only notice, database.web.js excludes SQLite/
WASM; native picker/storage/gestures and live Appwrite need a physical device.
Run lint/typecheck and the ten suites in DEMO_AND_TESTING.md, including new
material-files tests. Date tests run in Singapore and New York. Native bridge tests
and bundle exports do not prove rendered appearance. Use npm.cmd/npx.cmd if ps1
shims are blocked. Start: npx.cmd expo start --clear (never npx start).
Next task:
[Describe the request and acceptance criteria.]
```
