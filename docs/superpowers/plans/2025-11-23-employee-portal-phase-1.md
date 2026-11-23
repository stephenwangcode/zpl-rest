# Employee Portal Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a separate, read-only employee label form on port 8100 which loads printer and label choices from the existing zpl-rest API.

**Architecture:** Add a small Express/EJS application under `employee-portal/`, reusing the root project's installed Express and EJS dependencies. Its server fetches only the two read-only API endpoints using Node's built-in HTTP client and renders the results; it never accesses diskdb, ZPL, `/rest/print`, or the Zebra printer. Compose adds a separate `employee-portal` container and leaves the existing `zpl` service unchanged.

**Tech Stack:** Node.js 16, Express 4, EJS, built-in `http`/`assert`, Docker Compose.

---

## File structure

- Create: `employee-portal/server.js` — Express app factory, upstream read-only API client, port 8100 listener.
- Create: `employee-portal/views/index.ejs` — accessible employee form and upstream-error state.
- Create: `employee-portal/public/styles.css` — minimal responsive page styling.
- Create: `employee-portal/Dockerfile` — container image for the employee service using the root package dependencies.
- Create: `employee-portal/test/server.test.js` — Node assert integration test using a local mock of both allowed upstream endpoints.
- Modify: `package.json` — scripts for employee portal and its test.
- Modify: `docker-compose.yml` — separate port-8100 service without changing the existing `zpl` service.

### Task 1: Add the read-only employee service and page

**Files:**
- Create: `employee-portal/server.js`
- Create: `employee-portal/views/index.ejs`
- Create: `employee-portal/public/styles.css`
- Modify: `package.json`

- [ ] **Step 1: Write a failing integration test for successful upstream data loading and upstream failure messaging**

Create `employee-portal/test/server.test.js` with a local HTTP mock returning printer and label arrays, then assert `GET /` renders both names and the expected form controls. Start a second app with an unreachable URL and assert `GET /` returns HTTP 503 and a clear connection-error message.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:employee`
Expected: FAIL because `../server` does not exist.

- [ ] **Step 3: Implement the minimal service**

Implement `createApp({ apiUrl })` in `employee-portal/server.js`. `fetchCollection` must request only `/rest/printer` and `/rest/label`, require a 2xx JSON-array response, and timeout after five seconds. Route `/` must render `index.ejs` with the two result arrays, or return status 503 and the error view when either upstream GET fails. The executable entrypoint must listen on `process.env.PORT || 8100` and use `process.env.ZPL_API_URL || 'http://10.1.1.246:8110'`.

Render a form titled `VIRA Label Printing` with required controls named `printer`, `label`, `partNo`, `description`, `qty`, `attn`, `shippingDate`, and `copies`. Use `<select>` options from `printers` and `labels`; names must be HTML-escaped by EJS. Add browser validation: required text fields, qty/copies `min="1" step="1"`, and a required date. The sole submit control is disabled and says `Printing will be available in Phase 2`, so no print request can be sent.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:employee`
Expected: output ends with `employee portal tests passed` and exit code 0.

### Task 2: Add Docker deployment support without altering 8110

**Files:**
- Create: `employee-portal/Dockerfile`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add an employee image definition**

Create `employee-portal/Dockerfile`:

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY employee-portal ./employee-portal
CMD ["node", "employee-portal/server.js"]
```

- [ ] **Step 2: Add only the employee service to Compose**

Add this sibling service while preserving the existing `zpl` block unchanged:

```yaml
  employee-portal:
    build:
      context: .
      dockerfile: employee-portal/Dockerfile
    restart: always
    ports:
      - 8100:8100
    environment:
      PORT: 8100
      ZPL_API_URL: ${ZPL_API_URL:-http://10.1.1.246:8110}
```

- [ ] **Step 3: Validate Compose syntax**

Run: `docker compose config`
Expected: exit code 0 and separate `zpl` and `employee-portal` services, with `zpl` still mapped as `8110:8000`.

### Task 3: Perform local non-destructive verification and commit Phase 1

**Files:**
- Verify: `employee-portal/server.js`
- Verify: `employee-portal/views/index.ejs`
- Verify: `employee-portal/test/server.test.js`
- Verify: `docker-compose.yml`

- [ ] **Step 1: Run automated employee-service verification**

Run: `npm run test:employee`
Expected: exit code 0 and `employee portal tests passed`.

- [ ] **Step 2: Start a local mock upstream and employee service**

Run the mock used by `employee-portal/test/server.test.js`, start `node employee-portal/server.js` with `ZPL_API_URL` pointing to it and `PORT=8100`, then request `http://localhost:8100`. Verify the response includes `VIRA Label Printing`, both mocked printer and label names, and the form field names. Do not start or modify any service on port 8110.

- [ ] **Step 3: Validate failure behavior**

Start the employee service with `ZPL_API_URL=http://127.0.0.1:1`, request `http://localhost:8100`, and verify status 503 plus `Unable to load printers and label templates`.

- [ ] **Step 4: Inspect the staged change scope and commit**

Run: `git diff --check && git status --short`
Expected: only `employee-portal/`, `docs/superpowers/plans/2025-11-23-employee-portal-phase-1.md`, `package.json`, and `docker-compose.yml` are staged; user-provided `AGENTS.md` and `TASK.md` remain untracked and unstaged.

Run:

```bash
git add employee-portal docs/superpowers/plans/2025-11-23-employee-portal-phase-1.md package.json docker-compose.yml
git commit -m "feat: add employee label portal shell"
```

Expected: a local commit on `feature/employee-portal`; do not push, merge, deploy, or contact 8110.

## Self-review

- Spec coverage: Task 1 implements the port-8100 Express/EJS employee page, all six requested data inputs plus real printer/template selects, server-side upstream reads, validation, and explicit API failure feedback. Task 2 supplies a separate Docker deployment and retains the existing 8110 service. Task 3 proves startup/page content/API failure behavior and commits only Phase 1 work.
- Intentionally excluded: ZPL variable substitution, previewing, print/reprint requests, cookies, history, authentication, direct printer access, data storage, deployment, and any write request to the 8110 API.
- Placeholder scan: no TBD/TODO/fill-in placeholders; endpoint, paths, commands, expected outcomes, and Docker content are explicit.
- Type consistency: `createApp({ apiUrl })`, `ZPL_API_URL`, and the two `/rest/printer` and `/rest/label` endpoints are used consistently.
