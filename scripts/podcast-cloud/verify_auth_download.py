"""Verify a dedicated NotebookLM session can retrieve one known test audio.

The notebook and artifact IDs point to a disposable, unpublished smoke test.
This does not create new audio or print account details or credentials.
"""

import asyncio
import logging
import os
import tempfile
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from notebook_mcp import NotebookMCP


async def main():
    logging.disable(logging.CRITICAL)
    notebook_id = os.environ["SMOKE_NOTEBOOK_ID"]
    artifact_id = os.environ["SMOKE_ARTIFACT_ID"]
    env = {k: os.environ[k] for k in ("NOTEBOOKLM_HOME", "NOTEBOOKLM_PROFILE") if k in os.environ}
    with open(os.devnull, "w") as hidden_errors:
        async with stdio_client(StdioServerParameters(command="notebooklm-mcp", env=env), errlog=hidden_errors) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                client = NotebookMCP(session)
                await client.notebooks.list()
                with tempfile.TemporaryDirectory(prefix="notebooklm-smoke-") as folder:
                    audio = Path(folder) / "audio.m4a"
                    await client.artifacts.download_audio(notebook_id, str(audio), artifact_id=artifact_id)
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
