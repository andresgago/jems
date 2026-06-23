# JEMS Frontend — Test Commands

All commands run from `jems/jems-web-zero/`.

## Dev server

```bash
npm run dev        # starts Vite on http://localhost:5173
```

## Unit tests (Vitest + Testing Library)

### Run all unit tests once
```bash
npm run test
```

### Run in watch mode (re-runs on file change)
```bash
npm run test:watch
```

### Run a specific test file
```bash
npx vitest run src/pages/loads/__tests__/LoadFormPage.test.jsx
```

### Run tests matching a name pattern
```bash
npx vitest run -t "weight"
npx vitest run -t "trailer type"
```

### Run with coverage report
```bash
npx vitest run --coverage
```

## E2E tests (Playwright)

### Mock E2E — no backend needed

Intercepts all API calls with deterministic mock data. Runs in CI on every push.

```bash
npm run test:e2e
```

Reuse a dev server already running on port 5173 (faster iteration):

```bash
E2E_REUSE_SERVER=true npm run test:e2e
```

### Real E2E — requires backend running

Hits the real Django backend. Run locally before merging.

Prereqs:
- Backend running: `cd jems/jems-api && uv run python manage.py runserver`
- Seed data applied: `uv run python manage.py seed`
- A valid admin user exists

```bash
npm run test:e2e:real
```

Custom credentials or backend URL:

```bash
E2E_USERNAME=myuser E2E_PASSWORD=mypass npm run test:e2e:real
VITE_API_URL=http://localhost:8000/api/v1 npm run test:e2e:real
```

### Run a specific E2E spec

```bash
npx playwright test tests/e2e/smoke.mock.spec.js --project=mock
npx playwright test tests/e2e/smoke.real.spec.js --project=real
```

### Run a specific E2E test by name

```bash
npx playwright test --project=mock -g "weight defaults to 42000"
```

### Debug E2E in headed mode (browser visible)

```bash
npx playwright test --project=mock --headed
npx playwright test --project=mock --headed --slowmo=500
```

### Open Playwright UI (interactive test runner)

```bash
npx playwright test --project=mock --ui
```

### Show last E2E report

```bash
npx playwright show-report
```

## Lint

```bash
npm run lint
```

## Production build

```bash
npm run build
```

## Pre-merge checklist

- [ ] `npm run test` — unit tests green
- [ ] `npm run test:e2e` — mock E2E green (no backend needed)
- [ ] `npm run build` — build succeeds
- [ ] `npm run test:e2e:real` — real E2E green (backend must be running)
