"""Authenticated encryption for one dedicated, exclusively leased session.

Only ciphertext crosses the OIDC endpoint. No credential representations are logged.
"""
import base64
import hashlib
import json
import os
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

MAX_STATE_BYTES = 131072
CONTEXT = b"globaltrend:podcast:dedicated-session:v1:"


def validate_state(raw, expected_email):
    if not isinstance(raw, bytes) or not 1 <= len(raw) <= MAX_STATE_BYTES:
        raise ValueError("invalid session")
    state = json.loads(raw)
    cookies = state.get("cookies") if isinstance(state, dict) else None
    if not isinstance(cookies, list) or not cookies:
        raise ValueError("invalid session")
    if any(not isinstance(c, dict) or not isinstance(c.get("name"), str)
           or not isinstance(c.get("value"), str) for c in cookies):
        raise ValueError("invalid session")
    if not {"SID", "__Secure-1PSIDTS"} <= {c["name"] for c in cookies if c["value"]}:
        raise ValueError("incomplete session")
    account = state.get("notebooklm", {}).get("account", {}).get("email")
    if not expected_email or account != expected_email:
        raise ValueError("unexpected dedicated account")
    return raw


class SessionVault:
    def __init__(self, key, expected_email, bootstrap=None):
        self.key = base64.b64decode(key.strip(), validate=True)
        if len(self.key) != 32:
            raise ValueError("invalid encryption key")
        self.key_id = hashlib.sha256(self.key).hexdigest()[:16]
        self.expected_email = expected_email.strip()
        self.bootstrap = bootstrap

    @classmethod
    def from_environment(cls):
        # Remove credentials before the MCP server child process can inherit them.
        key = os.environ.pop("PODCAST_SESSION_KEY", "")
        account = os.environ.pop("PODCAST_ACCOUNT_EMAIL", "")
        bootstrap = os.environ.pop("NOTEBOOKLM_AUTH_JSON", "")
        return cls(key, account, bootstrap.encode() if bootstrap else None)

    def seal(self, raw, version):
        validate_state(raw, self.expected_email)
        if not isinstance(version, int) or version < 1:
            raise ValueError("invalid version")
        nonce = os.urandom(12)
        ciphertext = AESGCM(self.key).encrypt(nonce, raw, CONTEXT + str(version).encode())
        return {"format": 1, "key_id": self.key_id,
                "nonce": base64.b64encode(nonce).decode(),
                "ciphertext": base64.b64encode(ciphertext).decode()}

    def unseal(self, envelope, version):
        try:
            if not isinstance(envelope, dict) or set(envelope) != {"format", "key_id", "nonce", "ciphertext"}:
                raise ValueError()
            if envelope["format"] != 1 or envelope["key_id"] != self.key_id or version < 1:
                raise ValueError()
            nonce = base64.b64decode(envelope["nonce"], validate=True)
            ciphertext = base64.b64decode(envelope["ciphertext"], validate=True)
            if len(nonce) != 12 or len(ciphertext) > MAX_STATE_BYTES + 16:
                raise ValueError()
            raw = AESGCM(self.key).decrypt(nonce, ciphertext, CONTEXT + str(version).encode())
            return validate_state(raw, self.expected_email)
        except Exception:
            raise ValueError("encrypted session validation failed") from None

    def restore(self, folder, lease):
        if lease.get("recovery") is not None:
            raw = validate_state(json.dumps(lease["recovery"], ensure_ascii=False).encode(), self.expected_email)
        elif lease.get("envelope") is None:
            if lease["version"] != 0 or self.bootstrap is None:
                raise ValueError("dedicated session setup required")
            raw = validate_state(self.bootstrap, self.expected_email)
        else:
            raw = self.unseal(lease["envelope"], lease["version"])
        self.bootstrap = None
        # The MCP server resolves credentials from an isolated NotebookLM home.
        path = Path(folder) / "profiles" / "default" / "storage_state.json"
        path.parent.mkdir(parents=True, mode=0o700)
        # TemporaryDirectory is owner-only; the file is too. No symlinks/overwrite.
        fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(fd, "wb") as handle:
            handle.write(raw)
        # Restoring a fresh file must not fool NotebookLM's mtime guard.
        os.utime(path, (1, 1))
        return path
