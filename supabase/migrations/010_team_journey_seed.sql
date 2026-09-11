-- Configuração inicial da equipe conforme a cadência definida na V1.
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
