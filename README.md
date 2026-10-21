# Venn onboarding

React + TypeScript form using Vite, SCSS, React Hook Form, Zod, libphonenumber-js, and Axios. React Hook Form manages field state; Zod centralizes validation. Tested with Vitest and React Testing Library.

## Development

Use a current Node.js 22 LTS release.

```sh
npm ci
npm run dev
```

- `npm run build` — production build
- `npm run typecheck` — TypeScript checks
- `npm run lint` — ESLint
- `npm run test` — tests
- `npm run test:watch` — watch tests

## Structure and behavior

`src/features/onboarding` contains the form, validation, API functions, and corporation verification hook. `src/shared` contains the field component and HTTP utilities; `src/app` composes the page.

Validation runs on blur and submit. Corporation numbers require nine digits. Verification shares pending requests, caches the current successful number, and cancels/ignores stale requests after edits. Failures allow retry; backend corporation rejection clears the cache.

Submission waits for verification, prevents duplicates, preserves values on failure, and never automatically retries POST.

API: `https://fe-hometask-api.qa.vault.tryvault.com`, configured in `src/shared/api/client.ts`. Automated tests use mocks; live GET and POST integration was verified.
