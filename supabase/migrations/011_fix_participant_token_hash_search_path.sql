-- Ensure token-validation SECURITY DEFINER functions can resolve pgcrypto.digest
-- while keeping a restricted, explicit search_path.

alter function public.get_participant_record(text)
set search_path = public, extensions;

alter function public.get_ninety_day_participant_record(text)
set search_path = public, extensions;

alter function public.save_participant_response(text, jsonb, boolean)
set search_path = public, extensions;
