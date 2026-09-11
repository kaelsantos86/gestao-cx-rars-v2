# Gestão CX RARS — V2.0

Aplicativo de gestão e desenvolvimento da equipe de Experiência do Associado, evoluído a partir da plataforma Gestão CX RARS V1.0.

A V2 substitui a dependência de registros locais do navegador por uma arquitetura persistente, com identidade única por colaborador, timeline, histórico, auditoria e migração controlada do legado.

## Estado atual

**V2.0.0-alpha.1**

Fluxo-base implementado:

`Acesso → Home → Minha Equipe → Perfil do Colaborador → Timeline`

Módulos funcionais implementados:

`Marco Zero → preparação do gestor → link seguro → rascunho/envio do colaborador → leitura lado a lado → conclusão → bloqueio da participação → timeline`

`Avaliação de 90 dias → preparação gerencial → 5 notas do gestor → link seguro → 5 notas + 9 reflexões do colaborador → comparação → síntese e acordos → conclusão → liberação do PDI`

A V2 usa Supabase como base persistente e autenticação gerencial. A equipe pode entrar na jornada em pontos diferentes conforme momento profissional: Entrada, Consolidação, Estabilizado ou Transição.

## Princípios preservados da V1

- Seis módulos: Marco Zero, Avaliação de 90 dias, Competências, PDI Evolutivo, Feedback e Talento em Evidência.
- Perspectiva do gestor e do colaborador preservadas separadamente.
- Conteúdo original do colaborador não é sobrescrito pelo gestor.
- Registros concluídos tornam-se fontes para módulos posteriores conforme regras de elegibilidade.
- PDI é versionado por ciclo; o anterior permanece histórico somente leitura.
- Feedback de orientação/correção não alimenta Talento em Evidência.
- Exclusão de uma fonte é protegida quando há registros dependentes.
- Notas privadas nunca aparecem para o colaborador nem em PDFs compartilhados.
- Colaboradores não precisam recriar módulos anteriores quando entram na V2 em uma etapa mais madura da jornada.

## O que muda na V2

- Login e perfil do gestor.
- Banco centralizado: registros não dependem mais do navegador.
- Um `employee_id` permanente por colaborador.
- Timeline por colaborador.
- Ponto de entrada na jornada conforme momento profissional.
- Links temporários/seguros de participação do colaborador.
- Histórico de revisões e trilha de auditoria.
- Anexos/documentos vinculados à pessoa ou a um registro.
- Migração do legado com rastreabilidade de origem.

## Stack

- Next.js 16.3.4
- React 19.3.0
- TypeScript
- PostgreSQL / Supabase
- `@supabase/ssr` para sessão em cookies
- GitHub Actions para typecheck e build
- Vercel com deploy automático da branch `main`

## Executar localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

### Conectar ao Supabase

Copie `.env.example` para `.env.local` e informe:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Em produção, configure as mesmas variáveis no projeto Vercel para os ambientes necessários.

Aplique, em ordem, as migrations disponíveis em `supabase/migrations/`.

## Estrutura principal

- `supabase/migrations/001_initial_schema.sql`: modelo de dados inicial e RLS.
- `supabase/migrations/002_marco_zero_participation.sql`: participação segura do Marco Zero.
- `supabase/migrations/003_harden_manager_record_policies.sql`: restrição de escrita à equipe do gestor.
- `supabase/migrations/008_employee_journey_entry_schema.sql`: ponto de entrada e momento profissional.
- `supabase/migrations/009_ninety_day_participant_access.sql`: participação segura da Avaliação de 90 dias.
- `src/lib/domain.ts`: tipos de domínio compartilhados.
- `src/lib/module-rules.ts`: regras de dependência/elegibilidade entre módulos.
- `src/lib/data/team.ts`: camada de acesso aos dados da equipe e timeline.
- `src/lib/data/records.ts`: leitura de registros e participação segura.
- `src/lib/supabase/*`: clientes SSR/browser e atualização de sessão.
- `src/app/page.tsx`: dashboard operacional.
- `src/app/team/page.tsx`: diretório da equipe.
- `src/app/team/[id]/page.tsx`: perfil e timeline individual.
- `src/app/team/[id]/marco-zero/new/page.tsx`: criação gerencial do Marco Zero.
- `src/app/team/[id]/ninety-days/new/page.tsx`: criação gerencial da Avaliação de 90 dias.
- `src/app/records/[id]/marco-zero/page.tsx`: workspace do gestor do Marco Zero.
- `src/app/records/[id]/ninety-days/page.tsx`: workspace do gestor da Avaliação de 90 dias.
- `src/app/participate/marco-zero/[token]/page.tsx`: preparação do colaborador no Marco Zero.
- `src/app/participate/ninety-days/[token]/page.tsx`: autoavaliação do colaborador em 90 dias.
- `src/app/login/page.tsx`: acesso do gestor.
- `docs/architecture.md`: arquitetura funcional/técnica.
- `docs/migration-v1-v2.md`: estratégia de migração.
- `migration/legacy_manifest_template.csv`: inventário de registros/documentos legados.

## Proteção do legado

A V1 permanece como fonte protegida durante a construção da V2. Nenhum registro antigo deve ser apagado, sobrescrito ou assumido como migrado apenas por correspondência de nome. A migração exige rastreabilidade da origem e validação de integridade.

## Próxima entrega

Validar a Avaliação de 90 dias ponta a ponta com persistência real e, em seguida, iniciar a implementação da Avaliação de Competências mantendo as sete competências oficiais da V1.
