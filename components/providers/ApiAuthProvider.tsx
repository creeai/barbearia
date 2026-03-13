"use client"

import {createContext, useContext, useCallback} from "react"

const ApiAuthContext = createContext<string | null>(null)

export function ApiAuthProvider({
  accessToken,
  children
}: {
  accessToken: string | null
  children: React.ReactNode
}) {
  return (
    <ApiAuthContext.Provider value={accessToken}>
      {children}
    </ApiAuthContext.Provider>
  )
}

/** Retorna o token para chamadas à API. */
export function useApiToken(): string | null {
  return useContext(ApiAuthContext)
}

/** Retorna opções de headers com Authorization Bearer para fetch. */
export function useApiAuthHeaders(): Record<string, string> {
  const token = useApiToken()
  if (!token) return {}
  return {Authorization: `Bearer ${token}`}
}

/** Faz fetch para a API com Authorization Bearer. Uso: fetchWithAuth('/api/v1/companies') */
export function useApiFetch(): (url: string | URL, init?: RequestInit) => Promise<Response> {
  const token = useApiToken()
  return useCallback(
    (url: string | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      if (token) headers.set("Authorization", `Bearer ${token}`)
      return fetch(url, {...init, headers})
    },
    [token]
  )
}
