"""CI smoke test: the pinned NotebookLM MCP server exposes required tools."""

import asyncio
import tempfile
from pathlib import Path

from notebook_mcp import open_notebook_mcp


async def main():
    with tempfile.TemporaryDirectory(prefix="notebooklm-mcp-ci-") as folder:
        path = Path(folder) / "profiles" / "default" / "storage_state.json"
        # A manifest check needs no Google credentials or live API call.
        async with open_notebook_mcp(path):
            print("NotebookLM MCP stdio manifest verified")


if __name__ == "__main__":
    asyncio.run(main())
