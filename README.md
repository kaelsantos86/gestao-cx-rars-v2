# Gestão CX RARS — V2.0

Aplicativo de gestão e desenvolvimento da equipe de Experiência do Associado, evoluído a partir da plataforma Gestão CX RARS V1.0.

A V2 substitui a dependência de registros locais do navegador por uma arquitetura persistente, com identidade única por colaborador, timeline, histórico, auditoria e migração controlada do legado.

## Estado atual

**V2.0.0-alpha.1**

Fluxo-base implementado:

`Acesso → Home → Minha Equipe → Perfil do Colaborador → Timeline`

Primeiro módulo funcional implementado:

`Marco Zero → preparação do gestor → link seguro → rascunho/envio do colaborador → leitura lado a lado → conclusão → bloqueio da participação → timeline`

Enquanto o Supabase não estiver conectado, o aplicativo funciona em **modo demonstração**, permitindo validar navegação e arquitetura sem escrever dados reais. Ao configurar as variáveis do Supabase, as páginas passam a consultar a base persistente e exigem autenticação do gestor.

## Princípios preservados da V1

- Seis módulos: Marco Zero, Avaliação de 90 dias, Competências, PDI Evolutivo, Feedback e Talento em Evidência.
- Perspectiva do gestor e do colaborador preservadas separadamente.
- Conteúdo original do colaborador não é sobrescrito pelo gestor.
- Registros concluídos tornam-se fontes para módulos posteriores conforme regras de elegibilidade.
- PDI é versionado por ciclo; o anterior permanece histórico somente leitura.
- Feedback de orientação/correção não alimenta Talento em Evidência.
- Exclusão de uma fonte é protegida quando há registros dependentes.
- Notas privadas nunca aparecem para o colaborador nem em PDFs compartilhados.

## O que muda na V2

- Login e perfil do gestor.
- Banco centralizado: registros não dependem mais do navegador.
- Um `employee_id` permanente por colaborador.
- Timeline por colaborador.
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

Aplique, em ordem, as migrations disponíveis em `supabase/migrations/`.

## Estrutura principal

- `supabase/migrations/001_initial_schema.sql`: modelo de dados inicial e RLS.
- `supabase/migrations/002_marco_zero_participation.sql`: participação segura do Marco Zero.
- `supabase/migrations/003_harden_manager_record_policies.sql`: restrição de escrita à equipe do gestor.
- `src/lib/domain.ts`: tipos de domínio compartilhados.
- `src/lib/module-rules.ts`: regras de dependência/elegibilidade entre módulos.
- `src/lib/data/team.ts`: camada de acesso aos dados da equipe e timeline.
- `src/lib/data/records.ts`: leitura de registros e participação do Marco Zero.
- `src/lib/supabase/*`: clientes SSR/browser e atualização de sessão.
- `src/app/page.tsx`: dashboard operacional.
- `src/app/team/page.tsx`: diretório da equipe.
- `src/app/team/[id]/page.tsx`: perfil e timeline individual.
- `src/app/team/[id]/marco-zero/new/page.tsx`: criação gerencial do Marco Zero.
- `src/app/records/[id]/marco-zero/page.tsx`: workspace do gestor.
- `src/app/participate/marco-zero/[token]/page.tsx`: preparação do colaborador.
- `src/app/login/page.tsx`: acesso do gestor.
- `docs/architecture.md`: arquitetura funcional/técnica.
- `docs/migration-v1-v2.md`: estratégia de migração.
- `migration/legacy_manifest_template.csv`: inventário de registros/documentos legados.

## Proteção do legado

A V1 permanece como fonte protegida durante a construção da V2. Nenhum registro antigo deve ser apagado, sobrescrito ou assumido como migrado apenas por correspondência de nome. A migração exige rastreabilidade da origem e validação de integridade.

## Próxima entrega

Conectar um projeto Supabase real, aplicar as migrations, criar o perfil do gestor e cadastrar/vincular a equipe para validar o Marco Zero ponta a ponta com persistência real. Depois disso, iniciar a **Avaliação de 90 dias V2** usando o Marco Zero concluído como fonte direta.
