-- Contact details and the Faculty Advisor's name, edited by officers in
-- Nexus → Settings rather than in code. Empty until the Society fills them.
insert into core.settings (key, value, is_public, description) values
  ('contact.email', '"hello@auibsal.org"', true, 'The Society''s email address, shown on Contact.'),
  ('contact.telegram_url', '""', true, 'The Common Room on Telegram (https://t.me/…).'),
  ('society.faculty_advisor_en', '""', true, 'The Faculty Advisor''s name (English).'),
  ('society.faculty_advisor_ar', '""', true, 'The Faculty Advisor''s name (Arabic).')
on conflict (key) do nothing;

-- Public settings (contact details, the Journal's name) appear on the public
-- site: refresh it when they change.
create trigger revalidate after insert or update or delete on core.settings
  for each statement execute function private.queue_revalidation('about', 'journal');
