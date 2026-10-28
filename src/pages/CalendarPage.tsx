import { useNavigate } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import listPlugin from '@fullcalendar/list'
import { useOrders } from '../hooks/useOrders'
import { STATUS_COLORS } from '../components/StatusBadge'

export default function CalendarPage() {
  const nav = useNavigate()
  const { data = [] } = useOrders({})
  const events = data.filter((o) => o.due_date).map((o) => ({
    id: o.id,
    title: `#${o.order_no} ${o.title}`,
    start: o.due_date!,
    allDay: true,
    color: STATUS_COLORS[o.status],
  }))
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Calendar</h1>
      <div className="bg-white rounded-xl shadow p-2">
        <FullCalendar
          plugins={[dayGridPlugin, listPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{ left: 'prev,next', center: 'title', right: 'dayGridMonth,listWeek' }}
          buttonText={{ dayGridMonth: 'Month', listWeek: 'Week list' }}
          events={events}
          eventClick={(i) => nav(`/orders/${i.event.id}`)}
          height="auto"
        />
      </div>
    </div>
  )
}
