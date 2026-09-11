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

-- Configuração inicial coerente com a cadência já definida na V1.
-- Marco Zero e 90 dias são marcos de entrada, não pré-requisitos universais.
update public.employees
set
  professional_moment = 'entry',
  v2_entry_module = 'marco_zero',
  journey_note = 'Entrada na função: iniciar pela jornada Marco Zero → 90 dias → primeiro PDI.',
  journey_configured_at = now()
where display_name in ('Jessica', 'Leandro');

update public.employees
set
  professional_moment = 'consolidation',
  v2_entry_module = 'ninety_days',
  journey_note = 'Consolidação na função: Marco Zero não é refeito; iniciar pela avaliação de 90 dias e seguir para PDI.',
  journey_configured_at = now()
where display_name in ('Francieli', 'Khaoan');

update public.employees
set
  professional_moment = 'established',
  v2_entry_module = 'competencies',
  journey_note = 'Profissional estabilizado: etapas de entrada não são refeitas; seguir pelo ciclo semestral Competências → PDI.',
  journey_configured_at = now()
where display_name in ('Alisson', 'Daniela', 'Nathyelle');

comment on column public.employees.professional_moment is
  'Momento profissional atual que orienta a cadência gerencial na V2.';
comment on column public.employees.v2_entry_module is
  'Módulo pelo qual o colaborador entra na V2; não implica que módulos anteriores tenham sido concluídos.';
comment on column public.employees.journey_note is
  'Racional gerencial do ponto de entrada, sem inventar registros históricos.';
