"""Bounded cloud runner using the same SDK as notebooklm-py's MCP server.

Never print SDK exceptions, notebook contents, cookies or signed download URLs.
Google login is bootstrapped interactively on a separate, dedicated account.
"""
import asyncio
import json
import logging
import os
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path

AUDIENCE = "globaltrend-podcast-cloud-v1"
ENDPOINT = "https://emlgwhkgaihhrirhdpnp.supabase.co/functions/v1/podcast-cloud"
AMBIGUOUS = {"creating_notebook", "adding_source", "requesting_audio"}


class Cloud:
    def __init__(self):
        if os.environ.get("PODCAST_ENDPOINT", ENDPOINT) != ENDPOINT:
            raise ValueError("unexpected endpoint")

    def call(self, action, job=None, **data):
        # Obtain a new short-lived GitHub identity per request, never persist it.
        url = os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"]
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme != "https" or not (parsed.hostname or "").endswith(".actions.githubusercontent.com"):
            raise ValueError("unexpected identity provider")
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode({"audience": AUDIENCE})
        request = urllib.request.Request(url, headers={"Authorization": "Bearer " + os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]})
        with urllib.request.urlopen(request, timeout=30) as response:
            token = json.load(response)["value"]
        payload = {"action": action, **data}
        if job:
            payload["jobId"] = job["id"]
        request = urllib.request.Request(ENDPOINT, data=json.dumps(payload).encode(), headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
        with urllib.request.urlopen(request, timeout=45) as response:
            return json.load(response)

    def checkpoint(self, job, checkpoint, phase, message=""):
        self.call("checkpoint", job, data={"checkpoint": checkpoint, "phase": phase, "message": message})
        job["cloud_checkpoint"] = dict(checkpoint)

    def upload(self, job, path):
        size = path.stat().st_size
        if not 1 <= size <= 52428800:
            raise ValueError("audio size")
        # Inspect container bytes rather than trusting the extension.
        with path.open("rb") as audio:
            head = audio.read(16)
        if head[4:8] == b"ftyp":
            mime = "audio/mp4"
        elif head[:4] == b"RIFF" and head[8:12] == b"WAVE":
            mime = "audio/wav"
        elif head[:3] == b"ID3" or (len(head) >= 2 and head[0] == 255 and head[1] & 224 == 224):
            mime = "audio/mpeg"
        else:
            raise ValueError("unrecognized audio")
        target = self.call("upload", job, size=size, mime=mime)
        if not target.get("alreadyUploaded"):
            url = urllib.parse.urlparse(target["url"])
            if url.scheme != "https" or url.hostname != "emlgwhkgaihhrirhdpnp.supabase.co" or not url.path.startswith("/storage/v1/object/upload/sign/weekly-podcasts/"):
                raise ValueError("unexpected upload destination")
            request = urllib.request.Request(target["url"], data=path.read_bytes(), method="PUT", headers={"Content-Type": mime, "x-upsert": "false"})
            with urllib.request.urlopen(request, timeout=120) as response:
                response.read(4096)
        return self.call("complete", job, size=size, mime=mime)


async def produce(client, cloud, job, clock=time.monotonic, sleep=asyncio.sleep, budget=360):
    """Persist before every external mutation. Resume polls the exact artifact ID."""
    from notebooklm.types import AudioFormat, AudioLength
    cp = dict(job.get("cloud_checkpoint") or {})
    if cp.get("stage") in AMBIGUOUS:
        cloud.checkpoint(job, cp, "blocked", "외부 요청의 완료 여부를 NotebookLM에서 확인해 주세요.")
        return
    packet = job["packet"]
    if not cp.get("notebook_id"):
        cp["stage"] = "creating_notebook"
        cloud.checkpoint(job, cp, "opening")
        notebook = await client.notebooks.create("국제요정 " + packet["issueKey"] + " · " + job["id"])
        cp.update(notebook_id=notebook.id, stage="notebook_ready")
        cloud.checkpoint(job, cp, "adding_sources")
    if not cp.get("source_id"):
        cp["stage"] = "adding_source"
        cloud.checkpoint(job, cp, "adding_sources")
        source = await client.sources.add_text(cp["notebook_id"], "확정 제작 자료와 공식 출처", packet["sourceText"], wait=True)
        cp.update(source_id=source.id, stage="source_ready")
        cloud.checkpoint(job, cp, "adding_sources")
    if not cp.get("artifact_id"):
        cp["stage"] = "requesting_audio"
        cloud.checkpoint(job, cp, "generating")
        status = await client.artifacts.generate_audio(cp["notebook_id"], source_ids=[cp["source_id"]], language="ko", instructions=packet["instructions"], audio_format=AudioFormat.DEEP_DIVE, audio_length=AudioLength.DEFAULT)
        if not status.task_id or status.is_failed:
            raise RuntimeError("generation not accepted")
        cp.update(artifact_id=status.task_id, stage="watch")
        cloud.checkpoint(job, cp, "generating")
    deadline = clock() + budget
    while clock() < deadline:
        cloud.checkpoint(job, cp, "generating")  # Also checks cancellation/lease.
        status = await client.artifacts.poll_status(cp["notebook_id"], cp["artifact_id"])
        if status.is_complete:
            cp["stage"] = "download"
            cloud.checkpoint(job, cp, "collecting")
            with tempfile.TemporaryDirectory(prefix="podcast-") as folder:
                path = Path(folder) / "episode.m4a"
                await client.artifacts.download_audio(cp["notebook_id"], str(path), artifact_id=cp["artifact_id"])
                cloud.checkpoint(job, cp, "uploading")
                cloud.upload(job, path)
            print("One episode saved; publication follows the administrator's selection.")
            return
        if status.is_terminal:
            raise RuntimeError("artifact unavailable")
        await sleep(30)
    cloud.call("release", job)
    print("Generation pending; the next cloud run will poll the same artifact.")


def auth_failure(exc):
    # AuthExtractionError is a response/parser failure, not proof of sign-out.
    # Match the SDK's explicit signals, including subclasses, never substrings.
    return any(cls.__name__ in {"AuthError", "_LoginRedirectError", "HeadlessLoginRequiredError"}
               for cls in type(exc).__mro__)


def failure_reason(exc):
    """Closed diagnostic codes only. Never emit messages, URLs or responses."""
    if auth_failure(exc):
        return "login_rejected"
    names = {cls.__name__ for cls in type(exc).__mro__}
    if "AuthExtractionError" in names:
        return "token_extraction"
    if "RequiredCookieValidationError" in names:
        return {"missing_cookie": "cookie_missing", "psidts_unroutable": "cookie_route"}.get(
            getattr(exc, "reason", None), "cookie_validation")
    # These exact SDK prefixes distinguish a network/access gate from expiry.
    # Comparing a message is local; no portion of it is logged or persisted.
    if isinstance(exc, ValueError):
        message = str(exc)
        if message.startswith("Google's CookieMismatch page was reached"):
            return "cookie_scope"
        if message.startswith("NotebookLM redirected this request to its region / anti-abuse access gate"):
            return "access_gate"
    if names & {"TimeoutException", "TimeoutError"}:
        return "timeout"
    if "HTTPStatusError" in names:
        return "http_status"
    return "unclassified"


def report_job_failure(cloud, job, exc):
    cp = job.get("cloud_checkpoint", {})
    phase = "blocked" if cp.get("stage") in AMBIGUOUS else "needs_login" if auth_failure(exc) else "failed"
    try:
        cloud.checkpoint(job, cp, phase, "Google 로그인 또는 제작 상태를 확인해 주세요. 자동으로 새 음성을 만들지는 않았습니다.")
    except Exception:
        pass


async def run_session(cloud, vault, lease, client_factory, production_enabled=False):
    """Always persist verified rotations, including after a non-auth job failure."""
    job = None
    category = "invalid_state"
    stage = "restore"
    try:
        with tempfile.TemporaryDirectory(prefix="podcast-auth-") as folder:
            path = vault.restore(folder, lease)
            category = "transport"
            result = 0
            # HTTP only; no browser or copied browser profile in the runner.
            stage = "open_client"
            async with client_factory(path) as client:
                stage = "list_notebooks"
                await client.notebooks.list()
                stage = "record_health"
                cloud.call("health", ok=True)
                if production_enabled and not lease.get("auth_only", True):
                    job = cloud.call("claim").get("job")
                    if job:
                        stage = "produce"
                        try:
                            await produce(client, cloud, job)
                        except Exception as exc:
                            report_job_failure(cloud, job, exc)
                            if auth_failure(exc):
                                raise
                            result = 1
                    else:
                        print("No queued episode.")
            # The SDK saves rotated cookies on clean context exit. Store only
            # after successful live verification; never replace a good jar on failure.
            category = "storage"
            stage = "save_session"
            envelope = vault.seal(path.read_bytes(), lease["version"] + 1)
            cloud.call("session_save", data={"version": lease["version"], "envelope": envelope})
            print("Dedicated cloud session verified and encrypted state saved.")
            return result
    except Exception as exc:
        reason = failure_reason(exc)
        category = "auth" if auth_failure(exc) else category
        if job:
            report_job_failure(cloud, job, exc)
        try:
            cloud.call("session_fail", data={"category": category})
            if category == "auth":
                cloud.call("health", ok=False)
        except Exception:
            pass
        print("Cloud session check stopped safely (" + category +
              "; stage=" + stage + "; reason=" + reason + "). No credential details were logged.")
        return 1


async def main():
    logging.disable(logging.CRITICAL)
    try:
        from session_store import SessionVault
        from notebooklm import NotebookLMClient
        cloud = Cloud()
        vault = SessionVault.from_environment()
        lease = cloud.call("session_acquire").get("session")
        if not lease:
            print("Session checks paused, finished, or already leased. No work was claimed.")
            return 0
        factory = lambda path: NotebookLMClient.from_storage(
            path=str(path), keepalive=600, allow_headless=False,
            rate_limit_max_retries=0, server_error_max_retries=0)
        return await run_session(cloud, vault, lease, factory,
                                 production_enabled=os.environ.get("PODCAST_PRODUCE_ENABLED") == "true")
    except Exception:
        print("Cloud session setup unavailable. No credential details were logged.")
        return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
