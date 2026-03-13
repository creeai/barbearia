"use client"

import {useRef} from "react"
import {CreateUserForm} from "./CreateUserForm"
import {UsersList, type UsersListRef} from "./UsersList"

interface UsersPageClientProps {
  currentUserId?: string
}

export function UsersPageClient({currentUserId}: UsersPageClientProps) {
  const usersListRef = useRef<UsersListRef>(null)

  const handleUserCreated = () => {
    usersListRef.current?.refresh()
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <CreateUserForm onUserCreated={handleUserCreated} />
      <UsersList ref={usersListRef} currentUserId={currentUserId} />
    </div>
  )
}
