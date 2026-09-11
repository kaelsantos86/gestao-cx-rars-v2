-- Gestão CX RARS V2.0 — momento profissional e ponto de entrada na jornada

create type public.professional_moment as enum (
  'entry',
  'consolidation',
  'established',
  'transition'
);

alter table public.employees
  add column professional_moment public.professional_moment not null default 'established',
  add column v2_entry_module public.module_type not null default 'competencies',
  add column journey_note text,
  add column journey_configured_at timestamptz,
  add column journey_configured_by uuid references public.profiles(id);

comment on column public.employees.professional_moment is
  'Momento profissional atual que orienta a cadência gerencial na V2.';
comment on column public.employees.v2_entry_module is
  'Módulo pelo qual o colaborador entra na V2; não implica que módulos anteriores tenham sido concluídos.';
comment on column public.employees.journey_note is
  'Racional gerencial do ponto de entrada, sem inventar registros históricos.';
