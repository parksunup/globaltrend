"""Small, credential-free description of the actual execution environment."""
import os
import re

RUNNERS = ('github-hosted', 'self-hosted')


def runtime_problem():
    selected = os.environ.get('COLLECTOR_RUNNER')
    if selected and selected not in RUNNERS:
        return 'unsupported_runner_selection'
    if selected and os.environ.get('GITHUB_ACTIONS') == 'true':
        if os.environ.get('COLLECTOR_ACTUAL_RUNNER') != selected:
            return 'runner_selection_mismatch'
    return None


def runtime_info():
    github = os.environ.get('GITHUB_ACTIONS') == 'true'
    # A standalone process may be on a user PC or in a managed cloud workspace.
    # Do not infer physical location or app scheduling from Python's presence.
    actual = os.environ.get('COLLECTOR_ACTUAL_RUNNER') if github else 'standalone-process'
    if actual not in (*RUNNERS, 'standalone-process'):
        actual = 'unknown'
    selected = os.environ.get('COLLECTOR_RUNNER') or ('github-hosted' if github else 'standalone-process')
    run_id = os.environ.get('GITHUB_RUN_ID', '')
    commit = os.environ.get('GITHUB_SHA', '')
    return {
        'requested': selected if selected in (*RUNNERS, 'standalone-process') else 'invalid',
        'actual': actual,
        'scheduler_connected': github and actual in RUNNERS and run_id.isdigit(),
        'run_id': run_id if run_id.isdigit() else None,
        'commit': commit if re.fullmatch(r'[0-9a-f]{40}', commit) else None,
        'trigger': os.environ.get('RUN_EVENT') if github else 'manual',
    }
