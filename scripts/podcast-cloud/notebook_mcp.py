"""NotebookLM MCP client for the isolated GitHub Actions podcast runner.

Every NotebookLM operation goes through the pinned notebooklm-mcp stdio server.
The server receives only a temporary dedicated-account profile, never the
Supabase or GitHub credentials. Tool output and server stderr are not logged.
"""

import os
from contextlib import asynccontextmanager
from pathlib import Path
from types import SimpleNamespace


class MCPToolFailure(RuntimeError):
    def __init__(self, code="MCP"):
        super().__init__(code)
        self.code = code


class MCPAuthFailure(MCPToolFailure):
    pass


class NotebookMCP:
    def __init__(self, session):
        self.session = session
        self.notebooks = _Notebooks(self)
        self.sources = _Sources(self)
        self.artifacts = _Artifacts(self)

    async def call(self, name, **arguments):
        result = await self.session.call_tool(name, arguments)
        payload = getattr(result, "structured_content", None)
        if payload is None:
            payload = getattr(result, "structuredContent", None)
        if result.is_error:
            # Do not retain or print the tool message; it may contain source text,
            # URLs, or account details. Only the machine-readable error code is used.
            first = result.content[0].text if result.content and hasattr(result.content[0], "text") else ""
            code = first.split(":", 1)[0] if first.split(":", 1)[0] in {
                "AUTH", "RATE_LIMITED", "NOT_FOUND", "VALIDATION", "TIMEOUT",
                "NETWORK", "SERVER", "RPC", "CONFIG", "DEPENDENCY",
                "NOTEBOOK_LIMIT", "ARTIFACT_TIMEOUT", "SOURCE_MUTATION",
                "SOURCE_ADD", "ERROR", "UNEXPECTED"
            } else "MCP"
            if code == "AUTH":
                raise MCPAuthFailure(code)
            raise MCPToolFailure(code)
        if not isinstance(payload, dict):
            raise MCPToolFailure("MCP_SHAPE")
        return payload


class _Notebooks:
    def __init__(self, client):
        self.client = client

    async def list(self):
        value = await self.client.call("notebook_list", limit=1)
        if not isinstance(value.get("notebooks"), list):
            raise MCPToolFailure("MCP_SHAPE")
        return value["notebooks"]

    async def create(self, title):
        value = await self.client.call("notebook_create", title=title)
        if value.get("status") != "created" or not value.get("notebook_id"):
            raise MCPToolFailure("MCP_SHAPE")
        return SimpleNamespace(id=value["notebook_id"])


class _Sources:
    def __init__(self, client):
        self.client = client

    async def add_text(self, notebook_id, title, text, wait=True):
        value = await self.client.call("source_add", notebook=notebook_id,
                                       source_type="text", title=title, text=text,
                                       wait=wait)
        if not value.get("source_id") or (wait and value.get("ok") is not True):
            raise MCPToolFailure("SOURCE_ADD")
        return SimpleNamespace(id=value["source_id"])


class _Artifacts:
    def __init__(self, client):
        self.client = client

    async def generate_audio(self, notebook_id, source_ids, language, instructions,
                             audio_format, audio_length):
        value = await self.client.call("studio_generate", notebook=notebook_id,
                                       artifact_type="audio", source_ids=source_ids,
                                       language=language, instructions=instructions,
                                       audio_format=audio_format, audio_length=audio_length)
        return SimpleNamespace(task_id=value.get("task_id"),
                               is_failed=value.get("status") == "failed")

    async def poll_status(self, notebook_id, artifact_id):
        value = await self.client.call("studio_status", notebook=notebook_id,
                                       task_id=artifact_id)
        status = value.get("status")
        if not isinstance(status, str):
            raise MCPToolFailure("MCP_SHAPE")
        return SimpleNamespace(is_complete=value.get("is_complete") is True,
                               is_terminal=status in {"failed", "cancelled", "error"})

    async def download_audio(self, notebook_id, path, artifact_id):
        await self.client.call("studio_download", notebook=notebook_id,
                               artifact_type="audio", artifact_id=artifact_id,
                               path=path)
        if not Path(path).is_file():
            raise MCPToolFailure("MCP_SHAPE")


@asynccontextmanager
async def open_notebook_mcp(storage_path):
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    storage_path = Path(storage_path)
    if storage_path.parent.name != "default" or storage_path.parent.parent.name != "profiles":
        raise ValueError("unexpected MCP profile path")
    home = storage_path.parents[2]
    env = {"NOTEBOOKLM_HOME": str(home), "NOTEBOOKLM_PROFILE": "default",
           "NOTEBOOKLM_HL": "ko", "NOTEBOOKLM_LOG_LEVEL": "ERROR",
           "NOTEBOOKLM_MCP_STRICT_IDS": "1"}
    params = StdioServerParameters(command="notebooklm-mcp", env=env)
    with open(os.devnull, "w") as hidden_errors:
        async with stdio_client(params, errlog=hidden_errors) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                available = {tool.name for tool in (await session.list_tools()).tools}
                required = {"notebook_list", "notebook_create", "source_add",
                            "studio_generate", "studio_status", "studio_download"}
                if not required <= available:
                    raise MCPToolFailure("MCP_SCHEMA")
                yield NotebookMCP(session)
