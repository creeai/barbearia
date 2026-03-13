"use client"

import {useRef} from "react"
import {CreateBookingForm} from "./CreateBookingForm"
import {BookingsList, type BookingsListRef} from "./BookingsList"

export function BookingsPageClient() {
  const listRef = useRef<BookingsListRef>(null)

  const handleCreated = () => {
    listRef.current?.refresh()
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <CreateBookingForm onBookingCreated={handleCreated} />
      <BookingsList ref={listRef} />
    </div>
  )
}
