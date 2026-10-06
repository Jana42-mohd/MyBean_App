-- 0009: growth measurements (weight, length/height, head circumference) are stored as a new log type, 'growth'.
-- Run AFTER 0001-0008.
alter table public.logs drop constraint logs_type_check;
alter table public.logs add constraint logs_type_check
  check (type in ('nap', 'diaper', 'feeding', 'pumping', 'milestone', 'mood', 'growth'));
