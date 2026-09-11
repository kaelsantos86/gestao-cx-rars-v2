# Gestão CX RARS — V2.0

Aplicativo de gestão e desenvolvimento da equipe de Experiência do Associado, evoluído a partir da plataforma Gestão CX RARS V1.0.

A V2 substitui a dependência de registros locais do navegador por uma arquitetura persistente, com identidade única por colaborador, timeline, histórico, auditoria e migração controlada do legado.

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

## Stack inicial

- Next.js + TypeScript
- PostgreSQL / Supabase
- GitHub como fonte oficial de versionamento

## Estrutura

- `supabase/migrations/001_initial_schema.sql`: modelo de dados inicial.
- `src/lib/domain.ts`: tipos de domínio compartilhados.
- `src/lib/module-rules.ts`: regras de dependência/elegibilidade entre módulos.
- `src/app/*`: shell inicial de navegação da V2.
- `docs/architecture.md`: arquitetura funcional/técnica.
- `docs/migration-v1-v2.md`: estratégia de migração.
- `migration/legacy_manifest_template.csv`: inventário de registros/documentos legados.

## Etapa atual

Fundação V2.0. A próxima entrega funcional é o fluxo `Login → Home → Minha Equipe → Perfil do Colaborador → Timeline`, seguido pela migração do Marco Zero.
