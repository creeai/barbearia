"use client"

import {useRef} from "react"
import {CreateServiceForm} from "./CreateServiceForm"
import {ServicesList, type ServicesListRef} from "./ServicesList"

export function ServicesPageClient() {
  const listRef = useRef<ServicesListRef>(null)

  const handleCreated = () => {
    listRef.current?.refresh()
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <CreateServiceForm onServiceCreated={handleCreated} />
      <ServicesList ref={listRef} />
    </div>
  )
}
