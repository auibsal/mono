-- Covering indexes for foreign keys flagged by the Supabase performance
-- advisor (unindexed_foreign_keys): mostly "who did it" columns, which are
-- filtered when a user is deleted (ON DELETE SET NULL / CASCADE).

create index role_assignments_assigned_by_idx on access.role_assignments (assigned_by);
create index ledger_entries_counted_by_idx on charity.ledger_entries (counted_by);
create index ledger_entries_counted_with_idx on charity.ledger_entries (counted_with);
create index ledger_signoffs_signed_by_idx on charity.ledger_signoffs (signed_by);
create index receipts_uploaded_by_idx on charity.receipts (uploaded_by);
create index announcements_created_by_idx on content.announcements (created_by);
create index media_assets_uploaded_by_idx on content.media_assets (uploaded_by);
create index news_posts_author_id_idx on content.news_posts (author_id);
create index settings_updated_by_idx on core.settings (updated_by);
create index check_ins_checked_in_by_idx on events.check_ins (checked_in_by);
create index check_ins_rsvp_id_idx on events.check_ins (rsvp_id);
create index event_staff_added_by_idx on events.event_staff (added_by);
create index events_created_by_idx on events.events (created_by);
create index candidates_decided_by_idx on governance.candidates (decided_by);
create index election_results_position_id_idx on governance.election_results (position_id);
create index election_results_winner_candidate_id_idx on governance.election_results (winner_candidate_id);
create index elections_created_by_idx on governance.elections (created_by);
create index library_documents_uploaded_by_idx on governance.library_documents (uploaded_by);
create index minutes_created_by_idx on governance.minutes (created_by);
create index positions_role_key_idx on governance.positions (role_key);
create index resolutions_created_by_idx on governance.resolutions (created_by);
create index spending_approvals_lead_approver_idx on governance.spending_approvals (lead_approver);
create index spending_approvals_requested_by_idx on governance.spending_approvals (requested_by);
create index spending_approvals_treasurer_approver_idx on governance.spending_approvals (treasurer_approver);
create index agreements_signed_by_idx on journal.agreements (signed_by);
create index assignments_assigned_by_idx on journal.assignments (assigned_by);
create index decisions_decided_by_idx on journal.decisions (decided_by);
create index status_history_changed_by_idx on journal.status_history (changed_by);
create index activity_records_recorded_by_idx on membership.activity_records (recorded_by);
create index verification_requests_decided_by_idx on membership.verification_requests (decided_by);
create index removal_requests_handled_by_idx on programmes.removal_requests (handled_by);
create index six_words_moderated_by_idx on programmes.six_words (moderated_by);
