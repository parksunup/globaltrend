-- Reviewers need read-only access to unpublished team material.
-- Editor/admin write access remains controlled by the existing *_team_manage policies.

create policy publishers_team_read on public.publishers for select to authenticated
  using ((select private.is_team_member('reviewer')));
create policy sources_team_read on public.sources for select to authenticated
  using ((select private.is_team_member('reviewer')));
create policy source_items_team_read on public.source_items for select to authenticated
  using ((select private.is_team_member('reviewer')));
create policy draft_jobs_team_read on public.draft_jobs for select to authenticated
  using ((select private.is_team_member('reviewer')));
create policy reports_team_read on public.reports for select to authenticated
  using ((select private.is_team_member('reviewer')));
create policy report_evidence_team_read on public.report_evidence for select to authenticated
  using ((select private.is_team_member('reviewer')));
create policy legal_instruments_team_read on public.legal_instruments for select to authenticated
  using ((select private.is_team_member('reviewer')));
create policy law_versions_team_read on public.law_versions for select to authenticated
  using ((select private.is_team_member('reviewer')));
create policy provision_nodes_team_read on public.provision_nodes for select to authenticated
  using ((select private.is_team_member('reviewer')));
create policy criteria_sets_team_read on public.criteria_sets for select to authenticated
  using ((select private.is_team_member('reviewer')));
create policy criteria_team_read on public.criteria for select to authenticated
  using ((select private.is_team_member('reviewer')));
create policy comparison_cells_team_read on public.comparison_cells for select to authenticated
  using ((select private.is_team_member('reviewer')));
create policy comparison_cell_provisions_team_read on public.comparison_cell_provisions for select to authenticated
  using ((select private.is_team_member('reviewer')));
create policy report_provision_links_team_read on public.report_provision_links for select to authenticated
  using ((select private.is_team_member('reviewer')));
