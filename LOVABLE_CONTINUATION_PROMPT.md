# Continuação obrigatória — Importados Style (instrução aditiva para Lovable)

Esta instrução complementa o projeto existente. NÃO substitui a arquitetura nem autoriza reconstrução do zero.

## Contexto confirmado no repositório
- Aplicação atual em React 19 + TypeScript + TanStack Start/Router + Vite.
- Backend/dados estruturados em Supabase (PostgreSQL, Auth, RLS, Storage, RPC).
- Há migrations versionadas em `drizzle/migrations/`, tipos Supabase e funções SQL para estoque, pedidos e financeiro.
- O menu já apresenta módulos para pedidos, clientes, produtos, categorias, estoque, fornecedores, contas, usuários, atividades e configurações, mas a árvore de rotas versionada consultada contém somente raiz, autenticação, recuperação de senha e dashboard. Confirme no projeto conectado quais telas existem antes de criar qualquer coisa; não assuma que links de navegação representam módulos implementados.
- O roadmap atual descreve ERP/gestão interna. Não há evidência suficiente no repositório consultado de uma loja pública completa com vitrine, carrinho, checkout de cliente, pagamentos online ou frete.
- O projeto contém regras importantes em funções PostgreSQL SECURITY DEFINER e RLS. Respeite-as e não substitua chamadas RPC por gravações diretas no frontend.
- O repositório tinha um arquivo `.env` versionado. Ele foi removido do estado atual e adicionado ao .gitignore. Isso NÃO apaga valores do histórico Git: faça rotação imediata de qualquer chave/segredo que tenha sido publicado. Nunca mostre valores de segredos em logs, respostas ou arquivos.

## Ordem de execução obrigatória

### 1. Fazer inventário real antes de editar
1. Leia as instruções do projeto em `AGENTS.md`, o roadmap, todas as rotas, componentes, hooks, libs, migrations e testes.
2. Compare cada link do menu com uma rota real e funcional.
3. Liste o que existe, o que está parcialmente pronto, o que está ausente e o que está quebrado.
4. Não considere uma tela pronta apenas porque existe um componente; confirme CRUD, autorização, validação, estados de erro/vazio/carregamento e persistência.
5. Não marque tarefas como concluídas sem executar testes.

### 2. Preservar a arquitetura e os dados
1. Mantenha React/TypeScript/TanStack e Supabase/PostgreSQL, salvo justificativa técnica documentada e aprovação explícita.
2. Não introduza PHP/MySQL, Firebase ou um segundo banco concorrente.
3. Não edite migrations antigas já aplicadas. Para mudanças de schema, crie migration nova, reversível quando possível, segura e revisada.
4. Não execute DROP, TRUNCATE, reset de banco ou migração destrutiva.
5. Antes de qualquer mudança de banco, confirme ambiente, estado das migrations e backup restaurável.
6. Preserve IDs, pedidos, clientes, produtos, movimentações e histórico existentes.

### 3. Corrigir primeiro os riscos de maior impacto
1. Audite todas as funções SECURITY DEFINER: autorização interna, validação de parâmetros, search_path fixo, grants de EXECUTE e proteção contra chamada anônima/usuário não autorizado.
2. Revise RLS de todas as tabelas e Storage; teste acesso cruzado entre usuários e perfis.
3. Revise o provisionamento do primeiro administrador para evitar corrida de cadastro simultâneo e elevação indevida de privilégio. Não confie em metadados fornecidos pelo usuário para conceder admin.
4. Revise autenticação, bloqueio de usuário, recuperação de senha, expiração de sessão e invalidação de cache após logout/troca de usuário.
5. Audite a RPC `create_order`: identifique quais campos podem ser controlados por vendedor e quais devem ser derivados de dados confiáveis; não aplique regras de checkout público ao fluxo de venda manual sem distinguir os dois casos.
6. Teste concorrência de estoque, cancelamento, devolução, recebíveis e estornos em transações.
7. Garanta que status financeiros e de pedido só mudem por operações autorizadas e auditadas.

### 4. Fechar módulos já anunciados na navegação
Para cada item do menu, confirme rota, tela e fluxo completo. Prioridade:
- Produtos e categorias: cadastro, edição, ativação, imagens privadas, filtros e validação.
- Estoque: entradas, saídas, ajustes, histórico e prevenção de saldo negativo.
- Pedidos: criação, itens, parcelas, status, cancelamento, devolução e impressão.
- Clientes e fornecedores: CRUD com validação e proteção de dados.
- Financeiro: receber, pagar, contas/carteiras, fluxo de caixa, transferências e estornos.
- Usuários: papéis e ativação apenas por administrador autorizado.
- Atividades: trilha de auditoria consultável.
- Configurações: dados reais da loja e parâmetros operacionais.
Não deixe links apontando para rotas inexistentes nem botões sem ação. Se um módulo não puder ser implementado com segurança agora, esconda/desabilite o acesso com mensagem clara e registre a pendência — não simule dados.

### 5. Não confundir ERP com e-commerce público
O estado versionado indica principalmente um ERP interno. Antes de construir checkout público, confirme que esse é o escopo pretendido.
Se aprovado, implemente como fluxo separado:
- catálogo público com somente produtos publicados;
- variantes reais por tamanho/cor com estoque por variante;
- carrinho e preços recalculados no servidor;
- reserva/baixa de estoque transacional e proteção contra compras simultâneas;
- checkout com endereço e frete cotado por serviço real;
- pedido com snapshot imutável dos itens;
- Mercado Pago em sandbox, criação no servidor e webhook validado;
- idempotência de pedido/pagamento;
- área do cliente sem acesso a dados de outros clientes.
Não exiba frete, prazo, pagamento aprovado ou rastreio fictícios.

### 6. Testes e verificação
- Execute `bun run lint`, `bun run test` e `bun run build` (ou os comandos equivalentes documentados no projeto).
- Adicione testes unitários, integração e E2E para os fluxos críticos.
- Teste perfis admin/financeiro/vendas e usuário sem perfil.
- Teste RLS e RPC com sessões distintas.
- Teste compra/baixa/cancelamento/devolução concorrentes.
- Corrija erros reais; não esconda erros com casts, any, catch vazio ou supressões.
- Informe exatamente quais comandos rodaram, resultados e limitações. Não declare testes aprovados sem execução.

### 7. Entrega
Ao final, atualize `roadmap.md` e produza relatório com:
- arquitetura efetivamente encontrada;
- módulos completos, parciais, ausentes e quebrados;
- arquivos criados/alterados;
- migrations novas e justificativa;
- regras de segurança e RLS testadas;
- comandos/testes executados e resultados;
- falhas corrigidas e riscos restantes;
- segredos/configurações que o responsável precisa inserir em Secrets;
- pendências para produção.

## Regras finais
- Trabalhe incrementalmente, em pequenas alterações revisáveis.
- Preserve o visual e identidade existentes, sem sacrificar funcionamento.
- Não invente dados comerciais, CNPJ, endereço, credenciais, preços, políticas ou integrações.
- Não publique em produção, não execute migrações destrutivas e não altere credenciais sem autorização.
- Se uma premissa estiver incerta, pare nessa parte, explique o risco e peça a informação estritamente necessária.
- A meta é tornar o sistema existente verificável e confiável, não produzir apenas uma interface bonita.
