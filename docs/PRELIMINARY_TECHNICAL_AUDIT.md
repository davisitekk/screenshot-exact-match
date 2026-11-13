# Auditoria técnica preliminar — Importados Style

Data: 2026-11-13  
Escopo: inspeção estática da árvore e dos arquivos versionados do branch principal. Não houve execução local de build, lint, testes, consultas ao banco conectado nem testes dinâmicos de segurança. Portanto, este documento registra evidências e riscos a validar, não certificação de produção.

## Arquitetura confirmada
- Frontend React 19, TypeScript, TanStack Start/Router e Vite.
- Supabase como backend de dados: PostgreSQL, Auth, RLS, Storage e RPC.
- Há migrations SQL para perfis/papéis, configurações, categorias, catálogo, pedidos, estoque e financeiro.
- Há funções SQL de negócio, incluindo `create_order`, `register_stock_movement`, `update_order_status` e operações financeiras.
- Há testes Vitest para cálculos financeiros, categorias, CPF/CNPJ e roteamento.

## Itens confirmados
1. A árvore de rotas consultada contém raiz, autenticação, recuperação de senha e dashboard autenticado.
2. O menu lateral anuncia pedidos, clientes, produtos, categorias, estoque, fornecedores, contas a receber/pagar, fluxo de caixa, contas/carteiras, usuários, atividades e configurações. Não foram encontrados arquivos de rota correspondentes para esses módulos na árvore consultada. Isso indica links possivelmente sem destino; confirmar no Lovable antes de implementar.
3. O roadmap anterior ainda lista a maior parte desses módulos como pendente.
4. A migration de negócio contém funções SECURITY DEFINER para movimentação de estoque e pedidos, e a documentação AGENTS.md exige que a interface use RPC para efeitos de negócio.
5. A função `create_order` recebe JSON contendo preço unitário, desconto, frete, custos/taxas, método de pagamento e estados de pedido/pagamento. Como parece ser um fluxo de venda manual do ERP, alguns desses campos podem ser legítimos para operador autorizado. Ainda assim, devem ser validados no servidor e não podem ser reutilizados diretamente como checkout público confiável.
6. O cadastro inicial atribui papel de administrador ao primeiro usuário quando ainda não existe papel admin. Revisar concorrência de cadastros simultâneos e garantir que nenhum usuário posterior possa obter esse papel.
7. O projeto usa bucket privado `product-images` e URLs assinadas; manter esse modelo e validar as políticas do bucket no ambiente ativo.
8. O arquivo `.env` estava versionado. Foi removido do estado atual do repositório e as regras `.env`/ `.env.*` foram adicionadas ao `.gitignore`. A remoção do arquivo não apaga seu conteúdo do histórico Git.

## Riscos prioritários para validação
- **Crítico — credenciais:** se o `.env` continha segredos, eles podem continuar acessíveis no histórico público. Rotacionar todas as credenciais potencialmente expostas; revisar histórico com procedimento seguro. Não basta apagar o arquivo.
- **Alto — rotas/menu:** validar cada link anunciado no menu. Não assumir que componentes isolados equivalem a módulos funcionais.
- **Alto — banco/RPC:** revisar RLS, grants de EXECUTE, funções SECURITY DEFINER, validação de parâmetros e acesso de usuários sem papel.
- **Alto — bootstrap admin:** tornar a atribuição do primeiro administrador segura contra concorrência e abuso de cadastro.
- **Alto — pedido/estoque:** testar concorrência, preço/quantidade, cancelamento, devolução e idempotência no banco conectado.
- **Alto — escopo comercial:** o código consultado parece um ERP interno. Não há evidência suficiente de catálogo público, carrinho, checkout online, integração real de Mercado Pago ou cálculo de frete. Não declarar esses recursos implementados.
- **Médio — cobertura de testes:** testes existentes cobrem funções utilitárias e roteamento, mas a inspeção não demonstrou testes de integração/E2E dos fluxos críticos.

## Alterações feitas neste commit
- Regras do Git ignore atualizadas para ignorar arquivos de ambiente.
- Arquivo `.env` removido do estado atual do repositório. Segredos históricos não são removidos por essa ação.
- Roadmap ajustado para separar o ERP já versionado, pendências verificáveis e eventual escopo de e-commerce público.
- Criado `LOVABLE_CONTINUATION_PROMPT.md` como instrução aditiva para execução no Lovable.

## Limitações e próximos passos
- Nenhum teste foi executado neste ambiente.
- Nenhuma migration ou tabela foi alterada.
- Nenhum pagamento, frete ou webhook foi conectado.
- Nenhuma credencial foi rotacionada.
- A integração Lovable não disponibilizou uma ação de envio de prompt nesta sessão; o arquivo aditivo foi versionado para sincronizar com o projeto. A execução do prompt pela IA do Lovable ainda precisa ser iniciada no editor.
- Antes de produção, executar a auditoria dinâmica no projeto Supabase efetivamente conectado, rodar lint/test/build e comprovar restauração de backup.
