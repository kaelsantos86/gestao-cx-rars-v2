# Gestão CX RARS — V2.0

Aplicativo de gestão e desenvolvimento da equipe de Experiência do Associado, evoluído a partir da plataforma Gestão CX RARS V1.0.

A V2 substitui a dependência de registros locais do navegador por uma arquitetura persistente, com identidade única por colaborador, timeline, histórico, auditoria e migração controlada do legado.

## Estado atual

**V2.0 — alpha funcional integrada**

Fluxo-base em produção:

`Acesso → Home → Minha Equipe → Perfil do Colaborador → Jornada integrada → Timeline`

Os seis módulos da V1 já possuem fluxo funcional na V2:

- **Marco Zero** — preparação do gestor, link seguro do colaborador, rascunho/envio, leitura das perspectivas, conclusão, bloqueio da participação e timeline.
- **Avaliação de 90 dias** — preparação gerencial, cinco dimensões, autoavaliação e nove reflexões do colaborador, comparação, síntese, acordos e conclusão.
- **Competências** — sete competências oficiais, contexto do semestre, régua oficial, participação do colaborador, síntese e conclusão.
- **PDI Evolutivo** — ciclos versionados, até três prioridades, fontes formais, participação do colaborador, ativação/revisão e preservação do PDI anterior.
- **Feedback** — orientação/correção de rota e promoção/reconhecimento, com participação segura quando aplicável e regras próprias de integração.
- **Talento em Evidência** — seleção exclusiva de fontes elegíveis, snapshot das evidências, workspace executivo e versão de impressão. O acesso fica bloqueado quando não existem fontes formais válidas.

A V2 usa Supabase como base persistente e autenticação gerencial, com deploy automático da branch `main` na Vercel. A equipe entra na jornada em pontos diferentes conforme o momento profissional: Entrada, Consolidação, Estabilizado ou Transição.

## Regras centrais preservadas da V1

- Perspectiva do gestor e do colaborador permanecem separadas.
- Conteúdo enviado pelo colaborador não é sobrescrito pelo gestor.
- Registros concluídos tornam-se fontes para módulos posteriores somente quando elegíveis.
- PDI é versionado por ciclo; histórico anterior permanece preservado.
- Feedback de orientação/correção não alimenta Talento em Evidência.
- Talento em Evidência organiza recomendação e evidências, mas não decide promoção, mérito ou alteração salarial.
- Exclusão de fonte é protegida quando existem dependências.
- Notas privadas nunca aparecem para o colaborador nem em saídas compartilhadas.
- Pessoas que entram na V2 em momento mais maduro não precisam recriar etapas de entrada artificialmente.
- Um ciclo principal já aberto é retomado pelo perfil em vez de gerar um novo registro duplicado.

## Arquitetura V2

- Login e perfil do gestor.
- PostgreSQL / Supabase com RLS.
- Um `employee_id` permanente por colaborador.
- Relação formal gestor–colaborador.
- Timeline única por colaborador.
- Ponto de entrada da jornada conforme momento profissional.
- Links temporários e tokenizados para participação do colaborador.
- Respostas versionadas e trilha de auditoria.
- Dependências explícitas entre registros-fonte e registros derivados.
- Anexos/documentos vinculáveis à pessoa ou ao registro.
- Migração do legado com rastreabilidade da origem.

## Stack

- Next.js 16.3.4
- React 19.3.0
- TypeScript
- PostgreSQL / Supabase
- `@supabase/ssr`
- GitHub Actions para typecheck e build
- Vercel para deploy automático

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

Em produção, configure as mesmas variáveis no projeto Vercel.

As migrations ficam em `supabase/migrations/` e devem ser aplicadas na ordem de evolução registrada no projeto. Elas cobrem schema inicial, RLS, autenticação, configuração da jornada, participação segura dos módulos e hardening de funções/tokens.

## Estrutura principal

- `src/app/page.tsx`: dashboard operacional.
- `src/app/team/page.tsx`: diretório da equipe.
- `src/app/team/[id]/page.tsx`: perfil, jornada e timeline individual.
- `src/app/team/[id]/*/new/page.tsx`: criação dos ciclos pelo gestor.
- `src/app/records/[id]/*/page.tsx`: workspaces gerenciais dos módulos.
- `src/app/participate/*/[token]/page.tsx`: experiências seguras do colaborador.
- `src/lib/data/team.ts`: estado da jornada, próximo movimento e retomada de ciclos abertos.
- `src/lib/data/records.ts`: leitura de registros e participação segura.
- `src/lib/data/talent.ts`: seleção das fontes elegíveis para Talento.
- `src/lib/module-rules.ts`: regras de integração/elegibilidade.
- `docs/architecture.md`: arquitetura funcional/técnica.
- `docs/migration-v1-v2.md`: estratégia de migração.
- `migration/legacy_manifest_template.csv`: inventário para o legado.

## Proteção do legado

A V1 permanece como fonte protegida durante a construção e validação da V2. Nenhum registro antigo deve ser apagado, sobrescrito ou considerado migrado apenas por correspondência de nome. A migração exige fonte identificável, vínculo com o colaborador correto, preservação de autoria/status/data e validação posterior de integridade.

## Próxima entrega

1. Validar a jornada integrada ponta a ponta em uso real, começando pelos pontos de entrada corretos de cada colaborador.
2. Confirmar retomada de ciclos abertos, bloqueios e elegibilidade entre módulos.
3. Inventariar os registros reais da V1 e iniciar a migração controlada do histórico sem alterar a fonte legada.
4. Evoluir documentos, relatórios e recursos executivos após a validação dos fluxos principais.
