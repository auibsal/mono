-- Owner's decision (2026-10-08): remove the test content created while the
-- platform was being built, and the Natrok Athar partnership, which is no
-- longer part of the Society's plans. Accounts, memberships, pledges,
-- settings, semesters and the synced AUIB calendar are kept. Matches by
-- slug only, so it is a no-op on fresh databases.
delete from events.events where slug in ('hey', 'hey66');
delete from charity.partners where slug = 'natrok-athar';
