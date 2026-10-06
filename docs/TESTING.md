# Testing

Everything below also runs automatically on GitHub for every push (`.github/workflows/ci.yml`).

| What | Command | Needs |
|---|---|---|
| Types | `cd frontend && npm run typecheck` | Node 22 |
| Lint | `cd frontend && npx expo lint` | Node 22 |
| App logic (growth maths, charts data, offline queue, live sync, ...) | `cd frontend && npm test` | Node 22 |
| Database migrations + security rules | `PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres bash supabase/tests/run.sh` | `psql` and a PostgreSQL you can create databases on (nothing touches your real Supabase project) |
| Is the app ready to ship? | `cd frontend && npm run check:launch` | fails on purpose until `lib/appInfo.ts` and the app IDs are filled in |

## What the database tests prove
`supabase/tests/*.test.sql` run in a transaction that is rolled back. They cover, with real data on a real PostgreSQL:
households and who can see what, community posts / reports / auto-hide / blocking / suspension, account deletion (including a
partner keeping the shared history), shared sleep timers and the "both parents press Woke up" race, expecting babies, and the
security hardening (invite-code throttling, size limits, rate limits, profile privacy). `upgrade_check.test.sql` starts from a
database holding data as it was after migration 0001 and checks that every later migration carries it forward intact.

Adding a migration? Add or extend a `*.test.sql`. Each helper in `supabase/tests/helpers.sql` is documented in the file
(`t.login(user)`, `t.eq(actual, expected, label)`, `t.fails(sql, label)`).

## What the app tests prove
`frontend/tests/*.test.js` run with Node's built-in test runner. The logic modules in `frontend/lib` are compiled and run against
stand-ins for the phone and the backend (`tests/_mocks.js`), so no emulator is needed.

## What still needs a person
Real phones: notifications, password-reset links, photo upload, two phones syncing live, airplane mode. See `TEST_PLAN.md`.
