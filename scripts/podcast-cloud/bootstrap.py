"""One-time cloud-only Google token exchange. Never starts audio generation."""
import asyncio
import logging

from session_store import SessionVault
from worker import Cloud, run_master_bootstrap


async def main():
    logging.disable(logging.CRITICAL)
    try:
        cloud = Cloud()
        vault = SessionVault.from_environment()
        request = cloud.call("master_acquire").get("bootstrap")
        if not request:
            print("No pending dedicated-account bootstrap request.")
            return 0
        return await run_master_bootstrap(cloud, vault, request)
    except Exception:
        print("Dedicated bootstrap unavailable. No credential details were logged.")
        return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
