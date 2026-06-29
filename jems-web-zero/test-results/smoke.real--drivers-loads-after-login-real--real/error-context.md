# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.real.spec.js >> /drivers loads after login (real)
- Location: tests/e2e/smoke.real.spec.js:152:3

# Error details

```
Error: Real E2E backend is not reachable at http://localhost:8000/api/v1. Start the Django backend before running npm run test:e2e:real. Original error: apiRequestContext.post: connect ECONNREFUSED ::1:8000
Call log:
  - → POST http://localhost:8000/api/v1/auth/login/
    - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.55 Safari/537.36
    - accept: */*
    - accept-encoding: gzip,deflate,br
    - content-type: application/json
    - content-length: 43

```