# Roadmap — Importados Style

> Status revisado a partir da árvore de arquivos e dos módulos atualmente versionados. Um item só deve ser marcado como concluído após validação funcional e testes executados.

## Etapa 0 — Segurança e diagnóstico
- [x] Manter o `.env` versionado: ele contém só o endereço e a chave pública do backend, e o app publicado precisa dele (sem ele a tela fica em branco). Nenhum segredo esteve nesse arquivo, então não há chave a rotacionar.
- [ ] Validar configuração real do Supabase no Lovable Secrets e separar variáveis públicas de segredos.
- [ ] Executar auditoria completa de RLS, grants, funções SECURITY DEFINER e fluxos críticos no projeto Supabase conectado.
- [ ] Executar build, lint e suíte completa de testes no ambiente Lovable/CI.

## Etapa 1 — ERP interno existente (concluir e validar)
- [x] Estrutura inicial de banco, regras de estoque/pedidos/financeiro e permissões por perfil versionadas em migrations.
- [x] Testes unitários existentes para cálculos financeiros, catálogo, CPF/CNPJ e roteamento.
- [ ] Validar login, cadastro, recuperação de senha e provisionamento seguro do primeiro administrador.
- [x] Telas de Produtos (lista, filtros, cadastro/edição, ativar/inativar, movimentar estoque, exclusão bloqueada) e Categorias (árvore, cadastro/edição, nome repetido bloqueado, ativar/inativar, excluir com bloqueio) — testadas na tela em 14/11/2026. Envio de foto pelo formulário ainda não testado.
- [ ] Implementar ou confirmar rotas funcionais para estoque (histórico), pedidos, clientes, fornecedores, financeiro, usuários, atividades e configurações.
- [x] Corrigir links do menu que ainda não tenham uma rota implementada (marcar como "Em breve" até existirem).
- [ ] Validar dashboard e indicadores contra dados reais e regras contábeis definidas.
- [ ] Validar operações de pedido, estoque, contas a receber/pagar e reversões com testes de integração.
- [ ] Confirmar que todos os módulos respeitam os papéis admin, financeiro e vendas no banco, não apenas na interface.

## Etapa 2 — Operação comercial e integridade
- [ ] Variações de produto com estoque independente por tamanho/cor (não presumir que stock_qty geral atende esse requisito).
- [ ] Compras de mercadorias com entrada de estoque e contas a pagar atômicas.
- [ ] Histórico/auditoria completo das mudanças críticas e trilha de reversões.
- [ ] Relatórios gerenciais com exportação PDF e Excel.
- [ ] Múltiplos locais de estoque, se forem necessários à operação.
- [ ] Idempotência e concorrência para operações críticas, com testes de corrida.

## Etapa 3 — Loja virtual e integrações externas (somente se este for o escopo)
- [ ] Definir se o projeto continuará como ERP interno ou também terá uma loja pública com catálogo, carrinho e checkout.
- [ ] Se houver checkout público, especificar e implementar fluxo de compra separado das vendas manuais do ERP.
- [ ] Integrar Mercado Pago somente com credenciais privadas e webhooks autenticados, após testes em sandbox.
- [ ] Integrar frete (Melhor Envio/Correios) somente com credenciais e contrato/configuração válidos.
- [ ] E-mails e WhatsApp transacionais com consentimento e credenciais reais.
- [ ] Políticas comerciais, privacidade, trocas/devoluções e dados legais fornecidos pelo responsável da loja.
- [ ] Backup, restauração testada, monitoramento e plano de resposta a incidentes.

## Critério de conclusão
Não marcar como pronto para produção por aparência ou por compilação isolada. Exigir evidência de testes, autorização no banco, configuração de serviços externos, recuperação de backup e revisão de segurança.
