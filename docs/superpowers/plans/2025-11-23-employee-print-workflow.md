# Employee Print Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining Phase 2 employee workflow without exposing ZPL or printer configuration in the browser.

**Architecture:** The employee service remains an Express proxy over the existing 8110 API. It extracts simple `${name}` and `{{name}}` placeholders server-side, validates submitted values against them, renders preview ZPL server-side, and calls only the documented `/rest/preview`, `/rest/print`, and `/rest/jobs` endpoints. A random HttpOnly browser ID stored in a cookie is attached to print job data so the service can filter `/rest/jobs` before returning personal history.

**Tech Stack:** Node.js 16, Express 4, EJS, Mustache, built-in crypto/http/assert.

---

### Task 1: Server-side employee workflow API

**Files:**
- Modify: `employee-portal/server.js`
- Modify: `employee-portal/test/server.test.js`

- [ ] Write failing mock-upstream tests for label-field discovery, preview, a two-copy print, and filtered history.
- [ ] Run `npm run test:employee`; expect missing employee workflow routes.
- [ ] Add JSON endpoints: `GET /form-fields/:labelId`, `POST /preview`, `POST /print`, and `GET /history`. Extract simple ZPL/Mustache variables only, reject unknown printer/label/field values, limit values to 500 characters and copies to 1–100, and never return ZPL. Create/read a random HttpOnly `employee_browser_id` cookie. Add this ID only to the server-side print data and filter history by it. Forward preview and print requests server-side; print copies sequentially and return a clear partial-failure response.
- [ ] Run `npm run test:employee`; expect pass.

### Task 2: Employee page workflow

**Files:**
- Modify: `employee-portal/views/index.ejs`
- Modify: `employee-portal/public/styles.css`
- Test: `employee-portal/test/server.test.js`

- [ ] Replace the disabled Phase 1 button with a preview action and a print action, preserving native form validation.
- [ ] Add browser JavaScript that loads fields after label selection, builds normal inputs without ZPL text, posts preview/print to same-origin endpoints, displays preview/error/status, loads only server-filtered history, and lets a history item restore its saved form values for editing.
- [ ] Run `npm run test:employee`; expect pass.

### Task 3: Verify and commit

**Files:**
- Verify: `employee-portal/`
- Create: `docs/superpowers/plans/2025-11-23-employee-print-workflow.md`

- [ ] Run `npm run test:employee`, `docker compose config`, and `docker compose build employee-portal`.
- [ ] Use a local mock upstream and port 8100 to verify preview, two mock print requests, filtered history, and re-edit data restoration. Do not call production 8110 or Zebra.
- [ ] Stage only employee portal code and this plan, verify `git diff --cached --check`, and commit with `feat: add employee print workflow`.

## Scope guard

No authentication, database, direct printer connection, raw ZPL response, deployment, production API test, or changes to the existing 8110 service are included. Cookie identity is browser-local convenience, not authorization.
