-- Trigger functions should not be directly callable through the exposed API.
revoke all on function public.revoke_participant_tokens_on_completion() from public;
revoke all on function public.revoke_participant_tokens_on_completion() from anon;
revoke all on function public.revoke_participant_tokens_on_completion() from authenticated;
