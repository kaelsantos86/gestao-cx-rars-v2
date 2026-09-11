# Arquitetura V2.0

## Entidades centrais

### Usuário / Gestor
Conta autenticada que administra a própria equipe e os registros aos quais tem permissão.

### Colaborador
Identidade única e persistente. O nome pode mudar/corrigir sem quebrar vínculos porque todos os registros usam `employee_id`.

### Vínculo de gestão
Relaciona gestor e colaborador por período. Preserva histórico quando houver troca de gestor.

### Registro de módulo
Envelope comum para todos os módulos. Possui tipo, ciclo, status, datas, responsável e payload específico do módulo.

### Resposta do colaborador
Armazenada separadamente do conteúdo gerencial. Pode ter revisões até o bloqueio do módulo.

### Dependência entre registros
Grafo explícito de origem/destino. Substitui associações frágeis por nome e permite bloquear exclusões que quebrariam histórico.

### Documento / Anexo
Arquivo vinculado ao colaborador, ao registro ou aos dois. Suporta documentos de referência, avaliações e PDFs gerados.

### Fonte legada
Representa um registro, link ou arquivo vindo da V1. Permite migração progressiva sem apagar a origem.

### Auditoria
Registra criação, alteração, conclusão, arquivamento, geração de link, importação e exclusão lógica.

## Estados padronizados

- `draft`: em preparação.
- `awaiting_participant`: aguardando colaborador.
- `participant_submitted`: respostas recebidas.
- `in_conversation`: conversa/calibração em andamento.
- `active`: ciclo ativo, usado principalmente em PDI.
- `in_review`: revisão formal em andamento.
- `completed`: concluído e elegível como fonte conforme regra do módulo.
- `archived`: somente leitura.
- `cancelled`: cancelado sem apagar histórico.

## Regra de identidade

Nenhum vínculo entre módulos usa nome textual. Toda associação usa IDs. Nome, função e frente são atributos versionáveis do colaborador/vínculo.

## Permissões

### Gestor
Vê registros sob sua gestão, notas privadas, fontes e documentos autorizados.

### Colaborador
Acesso restrito por token/convite ao módulo específico. Nunca recebe notas privadas. Pode editar respostas enquanto a regra do módulo permitir.

### Administrador futuro
Opcional. Poderá administrar modelos, competências e governança sem acessar conteúdo privado por padrão.

## Dashboard

A Home deve responder:

- O que requer ação hoje?
- Quem tem marco próximo?
- Quais registros aguardam resposta?
- Quais PDIs estão em revisão?
- Quais avaliações semestrais se aproximam?
- Quais registros foram alterados recentemente?

## Perfil do colaborador

Cabeçalho: foto, nome, função, frente, tempo na função, momento atual.

Áreas:
- Visão geral.
- Timeline.
- Desenvolvimento.
- Competências.
- Feedbacks.
- Documentos.
- Talento em Evidência.

## Integração dos módulos

- Marco Zero -> 90 dias: somente origem concluída.
- 90 dias -> PDI: somente devolutiva concluída.
- Competências -> PDI: avaliação concluída.
- PDI anterior -> novo PDI: revisão registrada; anterior arquivado.
- Marco/90/Competências/PDI -> Talento: apenas fontes elegíveis.
- Feedback reconhecimento/promoção -> Talento: concluído e com evidência.
- Feedback orientação/correção -> Talento: proibido por regra de negócio.
