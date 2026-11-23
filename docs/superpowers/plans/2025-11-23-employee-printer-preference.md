# Employee Printer Preference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remember a browser's selected approved printer and select it automatically on future employee-portal visits.

**Architecture:** The existing Express employee portal continues to load the real printer list server-side. A same-origin JSON endpoint accepts a selected printer ID only after verifying it exists in that fetched list, then returns an HttpOnly, one-year, SameSite=Lax preference cookie. The page posts the selection on change; on the next load the server uses that cookie only when the printer is still present upstream.

**Tech Stack:** Node.js 16, Express 4, EJS, browser Fetch API, built-in `assert` and `http`.

---

## File structure

- Modify: `employee-portal/server.js` — parse the preference cookie, validate/save selections, and supply the selected ID to EJS.
- Modify: `employee-portal/views/index.ejs` — select the stored printer and send choice changes to the same-origin endpoint.
- Modify: `employee-portal/test/server.test.js` — prove a valid selection persists and invalid selection is rejected.
- Create: `docs/superpowers/plans/2025-11-23-employee-printer-preference.md` — this implementation plan.

### Task 1: Add a server-side validated printer preference cookie

**Files:**
- Modify: `employee-portal/server.js`
- Modify: `employee-portal/test/server.test.js`

- [ ] **Step 1: Write the failing preference integration test**

Extend the mock-upstream test to POST `{"printer":"printer-1"}` to `/preferences/printer`, assert HTTP 204 and a `Set-Cookie` value starting with `employee_printer=printer-1;`, then GET `/` with that cookie and assert the `printer-1` option has `selected`. POST `{"printer":"unknown"}` and assert HTTP 400.

- [ ] **Step 2: Run the employee test and confirm it fails**

Run: `npm run test:employee`
Expected: FAIL because `/preferences/printer` does not exist.

- [ ] **Step 3: Implement minimal cookie handling and validation**

In `server.js`, add a small `getCookie(request, name)` helper that decodes a semicolon-delimited Cookie header. Add `express.json()` before routes. On `GET /`, pass `selectedPrinterId` to EJS only if its value matches an item returned by `GET /rest/printer`. Add `POST /preferences/printer`: require a JSON string `printer`, fetch `/rest/printer`, reject an ID absent from that list with HTTP 400, otherwise respond 204 with `Set-Cookie: employee_printer=<encoded id>; Max-Age=31536000; Path=/; HttpOnly; SameSite=Lax`. Do not add a database, authentication, print endpoint, or any request to the Zebra printer.

- [ ] **Step 4: Run the employee test and confirm it passes**

Run: `npm run test:employee`
Expected: `employee portal tests passed`, exit code 0.

### Task 2: Persist selections from the existing form

**Files:**
- Modify: `employee-portal/views/index.ejs`
- Test: `employee-portal/test/server.test.js`

- [ ] **Step 1: Mark the stored printer option in EJS**

Change the printer option to include `selected` when `printer._id === selectedPrinterId`; the placeholder remains selected only when no stored selection exists.

- [ ] **Step 2: Add a same-origin change listener**

Add a small inline script that listens for `change` on `select[name="printer"]` and calls `fetch('/preferences/printer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ printer: event.target.value }) })`. It must not display the cookie or printer configuration, and a failed preference save must not block the user from changing the visible select.

- [ ] **Step 3: Run the test**

Run: `npm run test:employee`
Expected: exit code 0 and the stored selection assertion passes.

### Task 3: Verify and commit the isolated preference feature

**Files:**
- Verify: `employee-portal/server.js`
- Verify: `employee-portal/views/index.ejs`
- Verify: `employee-portal/test/server.test.js`

- [ ] **Step 1: Run the complete employee-service test**

Run: `npm run test:employee`
Expected: exit code 0.

- [ ] **Step 2: Run local browser-service verification with a mock API**

Start a local mock with a printer named `Local ZT610`, launch `node employee-portal/server.js` on port 8100 with `ZPL_API_URL` pointing at that mock, and verify: the page renders the printer, a POST to `/preferences/printer` sets the cookie, and a cookie-bearing request re-renders with `Local ZT610` selected. Do not start, stop, or call the 8110 production service.

- [ ] **Step 3: Check scope and commit**

Run: `git diff --check && git status --short`
Expected: only `employee-portal/` and this new plan are staged; `AGENTS.md` and `TASK.md` stay untracked and unstaged.

Run:

```bash
git add employee-portal docs/superpowers/plans/2025-11-23-employee-printer-preference.md
git commit -m "feat: remember employee printer selection"
```

Expected: a local commit on `feature/employee-portal`, without push, deploy, or changes to 8110.

## Self-review

- Scope coverage: stores and restores the browser printer preference, verifies current printer validity, and handles invalid saved values by leaving the placeholder selected.
- Excluded by design: printing, ZPL/template exposure, preview, data storage, history, authentication, direct Zebra access, and production deployment.
- Trust boundary: server verifies the ID against the upstream printer list before setting the cookie; cookie is HttpOnly and SameSite=Lax but intentionally is not authentication.
