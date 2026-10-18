"""CI verifies the expected disabled result without treating a gated run as a crash."""
import json
import os
import subprocess
import sys
from pathlib import Path

output = Path("work/collector-ci-dry-run.json")
env = {**os.environ, "SCHEDULE_ENABLED": "false", "COLLECTION_ENABLED": "false",
       "FREE_LIMITS_VERIFIED": "false", "CLOUD_PIPELINE_VERIFIED": "false"}
result = subprocess.run([sys.executable, "-m", "scripts.collector.run", "--output", str(output)], env=env)
if not output.exists():
    raise SystemExit(result.returncode or 1)
data = json.loads(output.read_text(encoding="utf-8"))
if result.returncode != 2 or data.get("mode") != "dry_run" or data.get("outcome") != "blocked" or not data.get("sources"):
    raise SystemExit("Unexpected collector dry-run result")
if any(source.get("status") != "held" or source.get("reason") != "source_disabled" for source in data["sources"]):
    raise SystemExit("Collector sources must remain explicitly disabled during integration")
print("Verified: disabled collector is blocked (exit 2), not a failed collection.")
