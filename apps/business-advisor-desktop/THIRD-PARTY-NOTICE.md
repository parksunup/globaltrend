# Third-party source notice

The ChatGPT direct-connection implementation in `src/vendor/ieumoffice-chatgpt/` adapts source from [pblsketch/openoffice](https://github.com/pblsketch/openoffice), licensed under Apache License 2.0. The upstream repository's full license and NOTICE texts are included in `third-party/ieumoffice-openoffice-LICENSE` and `third-party/ieumoffice-openoffice-NOTICE`.

Files copied from the upstream implementation:

- `oauth.ts` — OAuth authorization, PKCE, loopback callback, token exchange/refresh/revocation, and ID-token verification.
- `connection.ts` — sign-in lifecycle, serialized refresh, and session state.
- `credentials.ts` — token record validation and atomic local file store.

The copied source is from upstream commit `92e0022e98d2cfb0734ec381d8b32a3274fb055f`. Its upstream imports were adapted through the narrow interfaces under `src/vendor/`; the Electron storage adapter, IPC, and renderer are app-specific.

Adapter files in this directory provide the narrow interfaces those modules import. The local secret-storage adapter uses Electron `safeStorage` and refuses the `basic_text` backend. The callback page adapter is local to this app.
