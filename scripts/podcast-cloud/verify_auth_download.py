"""Verify a dedicated NotebookLM session can retrieve one known test audio.

The notebook and artifact IDs point to a disposable, unpublished smoke test.
This does not create new audio or print account details or credentials.
"""

import asyncio
import logging
import os
import tempfile
from pathlib import Path

from notebooklm import NotebookLMClient


async def main():
    logging.disable(logging.CRITICAL)
    notebook_id = os.environ["SMOKE_NOTEBOOK_ID"]
    artifact_id = os.environ["SMOKE_ARTIFACT_ID"]
    async with NotebookLMClient.from_storage(
        allow_headless=False,
        rate_limit_max_retries=0,
        server_error_max_retries=0,
    ) as client:
        await client.notebooks.list()
        with tempfile.TemporaryDirectory(prefix="notebooklm-smoke-") as folder:
            audio = Path(folder) / "audio.m4a"
            await client.artifacts.download_audio(
                notebook_id, str(audio), artifact_id=artifact_id
            )
            size = audio.stat().st_size
            with audio.open("rb") as stream:
                header = stream.read(8)
            if not 1 <= size <= 52_428_800 or header[4:8] != b"ftyp":
                raise RuntimeError("unexpected audio")
            print(f"NotebookLM session and audio download verified: {size} bytes")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception:
        print("NotebookLM session or audio download verification failed")
        raise SystemExit(1)
