"use client"

import {useRef, useState, useEffect} from "react"
import {useApiFetch} from "@/components/providers/ApiAuthProvider"
import {CreateApiKeyFormSuperAdmin} from "./CreateApiKeyFormSuperAdmin"
import {ApiKeysList, type ApiKeysListRef} from "@/components/admin/ApiKeysList"

interface Company {
  id: string
  name: string
  slug: string
}

export function ApiKeysPageClientSuperAdmin() {
  const fetchWithAuth = useApiFetch()
  const listRef = useRef<ApiKeysListRef>(null)
  const [companies, setCompanies] = useState<Company[]>([])

  useEffect(() => {
    fetchWithAuth("/api/v1/companies")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) setCompanies(data.data)
      })
      .catch(() => {})
  }, [])

  const handleApiKeyCreated = () => {
    listRef.current?.refresh()
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <CreateApiKeyFormSuperAdmin onApiKeyCreated={handleApiKeyCreated} />
      <ApiKeysList ref={listRef} companies={companies} />
    </div>
  )
}
