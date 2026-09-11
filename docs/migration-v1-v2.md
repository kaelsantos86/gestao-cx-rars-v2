# Migração V1 -> V2

## Regra zero

A V1 permanece intacta durante toda a implantação. A V2 nunca sobrescreve o legado no processo de importação.

## Fase 1 — Inventário

Para cada colaborador, listar:
- documentos existentes;
- links gerenciais V1 ainda acessíveis;
- módulo/tipo;
- status conhecido;
- data/ciclo;
- relação com outro registro;
- se possui resposta do colaborador;
- se existe PDF final.

## Fase 2 — Identidades

Criar um `employee_id` único para cada colaborador e um vínculo de gestão. Somente depois associar fontes legadas.

## Fase 3 — Importação segura

Cada item legado entra como `legacy_source` com:
- tipo de fonte;
- localização original;
- hash/identificador quando disponível;
- data de captura/importação;
- observação de integridade;
- vínculo com colaborador e, quando possível, registro V2 equivalente.

## Fase 4 — Reconstrução de registros

Quando o conteúdo V1 puder ser recuperado com segurança:
1. criar registro V2;
2. marcar `imported_from_legacy=true`;
3. preservar data original;
4. copiar conteúdo sem alterar autoria;
5. ligar ao `legacy_source`;
6. reconstruir dependências explícitas;
7. validar antes de marcar como migrado.

## Fase 5 — Conferência

Checklist por colaborador:
- quantidade de registros;
- ordem cronológica;
- status;
- respostas do colaborador;
- notas privadas;
- anexos/PDFs;
- dependências;
- PDI atual x arquivados;
- fontes elegíveis para Talento.

## Fase 6 — Corte

Somente depois da conferência:
- V2 vira sistema principal;
- V1 permanece como arquivo legado por período definido;
- nenhum link V1 é descartado até confirmação final.

## Tratamento de itens sem dados recuperáveis

Não inventar conteúdo. Criar apenas uma referência legada com status `reference_only`, data aproximada se conhecida e observação explícita de que o conteúdo não foi migrado.
