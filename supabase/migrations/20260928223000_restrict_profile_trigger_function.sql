-- This function is an internal auth trigger target, not a public RPC endpoint.
-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default, so revoke it
-- explicitly while leaving the auth.users trigger able to run as the owner.

revoke all on function public.handle_new_user_profile() from public;
revoke all on function public.handle_new_user_profile() from anon, authenticated;
