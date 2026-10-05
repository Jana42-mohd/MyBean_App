#!/usr/bin/env bash
# Runs every migration on an empty PostgreSQL and then the security/behaviour tests.
#
#   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres bash supabase/tests/run.sh
#
# Needs: psql, and a PostgreSQL you may create databases on. Nothing here touches your real Supabase project.
set -euo pipefail
cd "$(dirname "$0")"
PSQL=(psql -v ON_ERROR_STOP=1 -q -X)
DB=${TEST_DB:-bean_test}
MIGRATIONS=$(ls ../migrations/*.sql | sort)

fresh_db() {
  "${PSQL[@]}" -d postgres -c "drop database if exists $1" -c "create database $1"
  "${PSQL[@]}" -d "$1" -f stubs.sql
}

echo "== Fresh database: all migrations, then tests"
fresh_db "$DB"
for f in $MIGRATIONS; do "${PSQL[@]}" -d "$DB" -o /dev/null -f "$f"; done
"${PSQL[@]}" -d "$DB" -f helpers.sql
fail=0
for t in *.test.sql; do
  [ "$t" = "upgrade_check.test.sql" ] && continue
  if out=$("${PSQL[@]}" -d "$DB" -o /dev/null -f "$t" 2>&1); then echo "  PASS  $t"; else echo "  FAIL  $t"; echo "$out" | grep -E "FAIL|ERROR" | sed 's/^/        /'; fail=1; fi
done

echo "== Upgrade: migration 0001 with data, then every later migration"
fresh_db "${DB}_upgrade"
first=$(echo "$MIGRATIONS" | head -1)
"${PSQL[@]}" -d "${DB}_upgrade" -f "$first"
"${PSQL[@]}" -d "${DB}_upgrade" -f upgrade_seed.sql
for f in $(echo "$MIGRATIONS" | tail -n +2); do "${PSQL[@]}" -d "${DB}_upgrade" -o /dev/null -f "$f"; done
"${PSQL[@]}" -d "${DB}_upgrade" -f helpers.sql
if out=$("${PSQL[@]}" -d "${DB}_upgrade" -o /dev/null -f upgrade_check.test.sql 2>&1); then echo "  PASS  upgrade_check.test.sql"; else echo "  FAIL  upgrade_check.test.sql"; echo "$out" | grep -E "FAIL|ERROR" | sed 's/^/        /'; fail=1; fi

"${PSQL[@]}" -d postgres -c "drop database if exists $DB" -c "drop database if exists ${DB}_upgrade" >/dev/null
[ $fail -eq 0 ] && echo "All database tests passed." || { echo "Some database tests FAILED."; exit 1; }
