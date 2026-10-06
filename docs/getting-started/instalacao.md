# Instalação local

## Requisitos

- navegador atual;
- Node.js para scripts de configuração e validação;
- Python para servidor local e validação SQL;
- um projeto Supabase configurado.

## Preparação

Na raiz do repositório:

```powershell
Copy-Item .env.example .env
npm install
npm --prefix backend install
python -m pip install -r backend/requirements-dev.txt
```

Preencha `.env` conforme [Configuração](configuracao.md) e gere o arquivo público:

```powershell
npm --prefix backend run env:sync
```

## Executar

```powershell
python -m http.server 4173
```

Abra `http://127.0.0.1:4173/frontend/login/index.html`.

## Validar a preparação

```powershell
npm --prefix backend run docs:check
npm --prefix backend run sql:check
```

O frontend não possui build. Não use `file://`, porque sessão, imports e requisições
dependem de uma origem HTTP consistente.
