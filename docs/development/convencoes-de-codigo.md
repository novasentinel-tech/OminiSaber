# Convenções de código

## HTML

Preserve rotas relativas, atributos `data-*` para integração com scripts e estados acessíveis.

## CSS

Mantenha tokens locais, responsividade e componentes consistentes com o módulo existente.

## JavaScript

Centralize acesso ao Supabase no cliente compartilhado, trate carregamento/vazio/erro e registre falhas com contexto. Não introduza mocks para esconder indisponibilidade de dados.

## SQL

Use migrations incrementais, nomes `snake_case`, UUIDs e policies RLS explícitas. Confirme FKs antes de escrever joins PostgREST.

## Documentação

Documentos controlados usam código `OMNI-TEC-<categoria>-<sequência>`, versão,
status, classificação, público, responsável e data de revisão. Mudanças funcionais
atualizam o documento canônico, o módulo afetado e os registros de teste, débito ou
deploy quando aplicável. Não copie secrets, dados pessoais ou caminhos locais de
máquina para a documentação.
