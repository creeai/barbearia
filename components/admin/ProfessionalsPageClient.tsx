"use client"

import {useRef} from "react"
import {CreateProfessionalForm} from "./CreateProfessionalForm"
import {ProfessionalsList, type ProfessionalsListRef} from "./ProfessionalsList"

export function ProfessionalsPageClient() {
  const listRef = useRef<ProfessionalsListRef>(null)

  const handleCreated = () => {
    listRef.current?.refresh()
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <CreateProfessionalForm onProfessionalCreated={handleCreated} />
      <ProfessionalsList ref={listRef} />
    </div>
  )
}
