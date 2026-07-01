# Deploy Vercel + Supabase + AmploPay

## Variaveis da Vercel

Configure estas variaveis em Project Settings > Environment Variables:

```env
AMPLOPAY_API_BASE_URL=https://app.amplopay.com/api/v1
AMPLOPAY_PUBLIC_KEY=sua_chave_publica
AMPLOPAY_SECRET_KEY=sua_chave_privada
PUBLIC_BASE_URL=https://seu-dominio.com
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
```

Use `PUBLIC_BASE_URL` com o dominio final de producao. Ele entra no `callbackUrl` enviado para a AmploPay.

## Supabase

1. Crie um projeto no Supabase.
2. Abra SQL Editor.
3. Cole e execute o conteudo de `supabase-schema.sql`.
4. Em Project Settings > API, copie:
   - Project URL para `SUPABASE_URL`.
   - service_role key para `SUPABASE_SERVICE_ROLE_KEY`.

Nao use `SUPABASE_SERVICE_ROLE_KEY` no frontend. Ela deve ficar somente nas variaveis da Vercel.

## Fluxo

1. O cliente adiciona produtos ao carrinho.
2. O carrinho chama `/api/checkout-session`.
3. A tela `/checkout.html` coleta nome, email, telefone e CPF.
4. `/api/pix/receive` cria o Pix na AmploPay.
5. `/pix.html` mostra QR Code e copia e cola.
6. A AmploPay chama `/api/pix/callback` quando houver atualizacao.

## Teste local

Com a Vercel CLI instalada:

```bash
npm install -g vercel
vercel dev
```

Depois abra `http://localhost:3000`.
