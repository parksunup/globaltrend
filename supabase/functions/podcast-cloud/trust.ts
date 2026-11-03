export const audience = 'globaltrend-podcast-cloud-v1';
export function trusted(c: Record<string, unknown>) {
  return c.repository === 'parksunup/globaltrend' && c.repository_id === '1390776769'
    && c.repository_owner_id === '289618557' && c.repository_visibility === 'public'
    && c.ref === 'refs/heads/main' && c.sub === 'repo:parksunup@289618557/globaltrend@1390776769:ref:refs/heads/main'
    && c.workflow_ref === 'parksunup/globaltrend/.github/workflows/podcast-cloud.yml@refs/heads/main'
    && c.runner_environment === 'github-hosted' && ['schedule','workflow_dispatch'].includes(String(c.event_name))
    && /^\d+$/.test(String(c.run_id)) && /^\d+$/.test(String(c.run_attempt));
}
export function trustedBootstrap(c: Record<string, unknown>) {
  return c.repository === 'parksunup/globaltrend' && c.repository_id === '1390776769'
    && c.repository_owner_id === '289618557' && c.repository_visibility === 'public'
    && c.ref === 'refs/heads/main' && c.sub === 'repo:parksunup@289618557/globaltrend@1390776769:ref:refs/heads/main'
    && c.workflow_ref === 'parksunup/globaltrend/.github/workflows/podcast-master-bootstrap.yml@refs/heads/main'
    && c.runner_environment === 'github-hosted' && c.event_name === 'workflow_dispatch'
    && /^\d+$/.test(String(c.run_id)) && /^\d+$/.test(String(c.run_attempt));
}
