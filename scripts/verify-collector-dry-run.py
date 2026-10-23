"""CI verifies schedule-off blocks approved sources without HTTP or database access."""
import json
import os
import subprocess
import sys
from pathlib import Path

output = Path("work/collector-ci-dry-run.json")
env = {**os.environ, "SCHEDULE_ENABLED": "false", "COLLECTION_ENABLED": "false",
       "FREE_LIMITS_VERIFIED": "false", "CLOUD_PIPELINE_VERIFIED": "false"}
result = subprocess.run([sys.executable, "-m", "scripts.collector.run", "--write", "--scheduled", "--output", str(output)], env=env)
if not output.exists():
    raise SystemExit(result.returncode or 1)
data = json.loads(output.read_text(encoding="utf-8"))
if result.returncode != 2 or data.get("mode") != "write" or data.get("outcome") != "blocked" or not data.get("sources") or data.get("requests") != 0 or data.get("run_log", {}).get("status") != "skipped":
    raise SystemExit("Unexpected collector dry-run result")
if any(source.get("status") != "held" or source.get("reason") != "schedule_not_enabled" for source in data["sources"]):
    raise SystemExit("Disabled schedule must block every source before network or DB access")
print("Verified: schedule-off blocks execution (exit 2) even for approved collector sources.")
