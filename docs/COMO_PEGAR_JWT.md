# 🎯 Como Pegar o JWT - Guia Rápido

Este guia mostra **todas as formas práticas** de obter o JWT no projeto.

## 🚀 Forma Mais Rápida: Endpoint `/api/v1/auth/token`

Depois de fazer login no painel (`/login`), você pode obter o JWT fazendo uma requisição:

### No Navegador (Console do DevTools)

```javascript
// Abra o console do navegador (F12) e execute:
fetch('/api/v1/auth/token')
  .then(res => res.json())
  .then(data => {
    console.log('JWT:', data.data.accessToken)
    // Copie o token e use onde precisar!
  })
```

### Via cURL

```bash
# Depois de fazer login no navegador, copie os cookies e use:
curl -X GET http://localhost:3000/api/v1/auth/token \
  -H "Cookie: sb-<project>-auth-token=<cookie-value>"
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "...",
    "expiresAt": 1234567890,
    "expiresIn": 3600,
    "user": {
      "id": "uuid",
      "email": "user@example.com"
    }
  }
}
```

## 📝 Outras Formas de Obter o JWT

### 1. No Servidor (API Routes / Server Components)

```typescript
import {createClient} from "@/lib/supabase/server"

// Em uma API Route ou Server Component
const supabase = await createClient()
const {data: {session}} = await supabase.auth.getSession()

if (session) {
  const jwtToken = session.access_token
  console.log('JWT:', jwtToken)
}
```

### 2. No Cliente (Client Components / Browser)

```typescript
"use client"
import {createClient} from "@/lib/supabase/client"
import {useEffect, useState} from "react"

export default function MeuComponente() {
  const [token, setToken] = useState<string | null>(null)
  
  useEffect(() => {
    const supabase = createClient()
    
    // Obter sessão atual
    supabase.auth.getSession().then(({data: {session}}) => {
      if (session) {
        setToken(session.access_token)
        console.log('JWT:', session.access_token)
      }
    })
  }, [])
  
  return <div>Token: {token ? token.substring(0, 20) + "..." : "Não autenticado"}</div>
}
```

### 3. Via Console do Navegador (Depois do Login)

Abra o console do navegador (F12) e execute:

```javascript
// Método 1: Via localStorage (onde o Supabase armazena)
const supabaseKey = Object.keys(localStorage).find(key => key.includes('supabase.auth.token'))
if (supabaseKey) {
  const tokenData = JSON.parse(localStorage.getItem(supabaseKey))
  console.log('JWT:', tokenData?.currentSession?.access_token)
}

// Método 2: Via fetch (mais confiável)
fetch('/api/v1/auth/token')
  .then(res => res.json())
  .then(data => console.log('JWT:', data.data?.accessToken))
```

### 4. Via Cookies (Inspecionar no DevTools)

1. Abra o DevTools (F12)
2. Vá em **Application** (Chrome) ou **Storage** (Firefox)
3. Clique em **Cookies** → `http://localhost:3000`
4. Procure por cookies que começam com `sb-` e contenham `auth-token`
5. O JWT está dentro do cookie (mas é mais fácil usar o endpoint acima)

## 🔧 Usando o JWT em Requisições

Depois de obter o JWT, você pode usá-lo em requisições:

### Exemplo: Criar Company (Super Admin)

```bash
# 1. Primeiro, obtenha o JWT (faça login e use o endpoint acima)
JWT_TOKEN="seu-jwt-aqui"

# 2. Use o JWT na requisição
curl -X POST http://localhost:3000/api/v1/companies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "name": "Minha Empresa",
    "slug": "minha-empresa"
  }'
```

### Exemplo: No JavaScript/TypeScript

```typescript
// Obter o JWT
const response = await fetch('/api/v1/auth/token')
const {data} = await response.json()
const jwtToken = data.accessToken

// Usar o JWT em uma requisição
const apiResponse = await fetch('/api/v1/companies', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtToken}`
  },
  body: JSON.stringify({
    name: 'Minha Empresa',
    slug: 'minha-empresa'
  })
})
```

## ⚠️ Importante

1. **O JWT expira** - geralmente após 1 hora. Se expirar, faça login novamente.
2. **Use HTTPS em produção** - nunca exponha o JWT em URLs ou logs.
3. **O JWT é lido automaticamente dos cookies** - você não precisa passar manualmente na maioria dos casos.
4. **Para a API REST** (endpoints de agendamento), use **API Keys**, não JWT. O JWT é apenas para endpoints administrativos.

## 🐛 Troubleshooting

### "Não autenticado" ao chamar `/api/v1/auth/token`

- ✅ Certifique-se de ter feito login em `/login`
- ✅ Verifique se os cookies estão sendo enviados (use o DevTools)
- ✅ Tente fazer login novamente

### JWT expirado

- ✅ Faça login novamente em `/login`
- ✅ O Supabase renova automaticamente, mas se expirar completamente, precisa fazer login

### Não consigo usar o JWT em requisições

- ✅ Verifique se está usando `Authorization: Bearer <token>` (com espaço após "Bearer")
- ✅ Certifique-se de que o endpoint aceita JWT (endpoints administrativos sim, endpoints de agendamento não)
- ✅ Verifique se o token não expirou

## 📚 Referências

- [Documentação completa do JWT](./SUPABASE_JWT.md)
- [README principal](../README.md#-autenticação)
