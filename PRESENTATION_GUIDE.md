# Sanctum Keeper — Presentation Guide

## 30-second introduction
Sanctum Keeper is a local-first desktop file organizer. It scans a user-selected folder, previews proposed destinations, and organizes files by type or custom rules. Its key design goal is to make organization transparent and recoverable: it avoids intentional overwrites, skips temporary download files, keeps a local operation journal, supports guarded Undo, and identifies duplicates by content hash without deleting them.

## Problem and solution
Downloads and Desktop folders collect mixed file types. Manual sorting takes time, while unsafe automation can overwrite data or move files while they are still being written. Sanctum Keeper provides a preview-and-confirm workflow plus an opt-in watcher for new files.

## Architecture in simple language
- The **renderer** is the visible screen. It cannot call Node.js filesystem APIs directly.
- The **preload bridge** exposes only named operations, such as choosing a folder or requesting a scan.
- The **main process** validates requests and performs filesystem work.
- The **Rule Engine** chooses a category from the extension or a custom prefix/extension rule.
- The **Task Queue** limits concurrent work to four operations.
- The **File Mover** selects a collision-safe destination and verifies copied content when moving across devices.
- The **Journal** records operation state and supports History/Undo.
- **Chokidar** watches for newly added files and waits for write activity to settle.
- **Duplicate Finder** compares SHA-256 hashes of file contents.

## 5–7 minute live demo
1. **0:00–0:45 — Introduce the problem.** Show a disposable folder with several file types and duplicate copies.
2. **0:45–1:30 — Scan.** Select the test folder and scan it. Emphasize that scanning does not move anything.
3. **1:30–2:15 — Preview.** Search and filter the file list. Explain category and destination columns.
4. **2:15–3:15 — Organize.** Confirm the operation and show the category folders created in the test directory.
5. **3:15–4:00 — History and Undo.** Show the journal entry and undo a suitable move; point out that integrity is checked before restoration.
6. **4:00–4:45 — Custom rules.** Add a rule for a filename prefix such as `assignment` and set a destination category/subfolder.
7. **4:45–5:30 — Duplicate Finder.** Show identical copies grouped by SHA-256. Explain that it never deletes them.
8. **5:30–6:15 — Auto mode.** If time permits, start Auto mode on the dedicated test folder, copy a new file into it, wait for it to settle, then stop monitoring.
9. **6:15–6:45 — Safety summary.** Explain the Electron security boundary, temporary-file filter, collision handling, and local data storage.

## Demo checklist
- [ ] Run `npm test` and retain the actual output.
- [ ] Launch the app before judges arrive.
- [ ] Prepare a disposable folder, never use real Downloads/Desktop for the first demo.
- [ ] Include two identical copies of one file and at least four different file types.
- [ ] Confirm there is no important file already in a category folder.
- [ ] Test Undo on one file.
- [ ] Keep Auto mode off until demonstrating it; stop it afterward.
- [ ] Do not claim a test or recovery behavior was verified unless you ran it.

## Likely judging questions and answers

1. **Why Electron?** It lets us build a desktop app using HTML, CSS, JavaScript, and Node.js, which keeps the stack approachable.
2. **Why local-first?** Files remain on the user's computer and the core workflow does not need a cloud account or server.
3. **Why preview before moving?** It gives the user a chance to inspect destinations before any filesystem changes.
4. **How are categories chosen?** The Rule Engine checks enabled custom rules first, then extension lists, then defaults to Others.
5. **How are custom rules matched?** The current version supports filename-prefix and extension matching.
6. **What happens if a filename already exists?** The mover tries a numbered alternative such as `report (1).pdf`; it does not intentionally overwrite an existing file.
7. **Why skip `.crdownload` and `.part`?** They commonly represent files that are still downloading or being written.
8. **Does stability checking guarantee a download is finished?** No. It only waits for a quiet period; some programs may pause and resume writes.
9. **What is the Electron preload bridge?** A small, controlled layer that exposes selected functions to the UI without exposing all Node.js APIs.
10. **Why disable `nodeIntegration`?** It reduces the damage a compromised renderer could cause by preventing direct Node.js access.
11. **What does `contextIsolation` do?** It separates the page's JavaScript context from Electron's privileged preload context.
12. **Where is the journal stored?** In a JSON file in Electron's user-data directory on the local machine.
13. **Why write a journal?** It records what the app intended to do and what happened, which makes operations easier to inspect and undo.
14. **How does Undo work?** It checks that the moved file still matches its recorded SHA-256 hash, then restores it to the original path or a collision-safe alternative.
15. **What if the file changed after moving?** Undo is blocked rather than risking overwriting or restoring unexpected content.
16. **How does duplicate detection work?** It streams each file through SHA-256 and groups files with identical hashes.
17. **Why not delete duplicates automatically?** Hash-based detection is a report, not user consent to delete; users should inspect duplicates themselves.
18. **Why use streams for hashing?** It avoids loading a large file entirely into memory.
19. **Why limit concurrency to four?** It keeps the workload bounded and avoids opening too many filesystem operations at once.
20. **What happens if one file fails?** The operation is recorded as failed and the remaining jobs can continue.
21. **How are paths validated?** The main process requires absolute paths, checks that selected sources belong to the chosen folder, and restricts destinations to that folder.
22. **Can the app scan subfolders?** Not in the current version; it scans only the selected folder's immediate files to reduce surprise and repeated processing.
23. **What about cross-drive moves?** It copies to a temporary file, hashes source and copy, commits the destination, and removes the source only after verification.
24. **Is crash recovery fully transactional?** No. The journal helps identify unfinished work, but ambiguous filesystem states must be inspected rather than blindly replayed.
25. **What is the biggest current limitation?** The application still needs thorough Windows-specific testing, especially around locked files, permissions, and interrupted operations.
26. **How would you improve it next?** Add a dedicated recovery screen, stronger integration tests for cross-drive and crash cases, signed Windows packaging, and a more explicit organization-root setting.
27. **Does it send file data to a server?** No server is part of the core architecture; file processing is local.
28. **Can it execute installers or scripts?** No. It categorizes them but does not execute them.
29. **How do you test it safely?** Unit tests use generated temporary directories; live demos use a disposable test folder.
30. **What makes it more than a simple sorting script?** It combines preview, configurable rules, a desktop security boundary, collision handling, journaling, Undo, monitoring, duplicate reporting, and tests.

## Be honest about limitations
Do not claim the app is fully crash-proof, universally safe on every filesystem, or verified on Windows unless those checks have been performed. The stability timer is a heuristic. The test suite covers selected core logic, not every possible OS failure. Demonstrate using disposable files.
