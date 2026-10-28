import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DndContext, DragEndEvent, DragOverlay, MouseSensor, TouchSensor,
  useDraggable, useDroppable, useSensor, useSensors,
} from '@dnd-kit/core'
import { useQueryClient } from '@tanstack/react-query'
import { useOrders } from '../hooks/useOrders'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/dates'
import { STATUSES, statusLabel, type OrderStatus, type OrderSummary } from '../lib/types'
import { STATUS_COLORS } from '../components/StatusBadge'

const cardCls = 'bg-white rounded-lg shadow p-3 text-sm min-h-[44px] select-none'

function CardBody({ o }: { o: OrderSummary }) {
  return (
    <>
      {/* draggable={false}: stops the browser's native link drag from hijacking a mouse drag */}
      <Link to={`/orders/${o.id}`} draggable={false} className="font-medium text-indigo-600">#{o.order_no}</Link> {o.title}
      <div className="text-slate-500">{o.customer_name} · {formatDate(o.due_date)}</div>
    </>
  )
}

function Card({ o }: { o: OrderSummary }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: o.id })
  return (
    <div
      ref={setNodeRef} {...attributes} {...listeners}
      // manipulation keeps swipe-scrolling; callout none stops iOS link preview on the 250ms long-press
      style={{ touchAction: 'manipulation', WebkitTouchCallout: 'none' }}
      className={`${cardCls} ${isDragging ? 'opacity-30' : ''}`}
    >
      <CardBody o={o} />
    </div>
  )
}

function Column({ status, orders, collapsed, toggle }: {
  status: OrderStatus; orders: OrderSummary[]; collapsed: boolean; toggle: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div ref={setNodeRef} className={`w-64 shrink-0 rounded-xl p-2 space-y-2 ${isOver ? 'bg-indigo-100' : 'bg-slate-100'}`}>
      <button onClick={toggle} className="w-full min-h-[44px] flex items-center justify-between font-semibold capitalize"
        style={{ color: STATUS_COLORS[status] }}>
        {statusLabel(status)} ({orders.length}) <span>{collapsed ? '▸' : '▾'}</span>
      </button>
      {!collapsed && orders.map((o) => <Card key={o.id} o={o} />)}
    </div>
  )
}

export default function Board() {
  const qc = useQueryClient()
  const { data = [] } = useOrders({})
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(['delivered', 'cancelled']))
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )
  const active = data.find((o) => o.id === activeId)

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null)
    if (!e.over) return
    const status = e.over.id as OrderStatus
    const o = data.find((x) => x.id === e.active.id)
    if (!o || o.status === status) return
    // optimistic: move the card now instead of snapping back until the refetch lands
    qc.setQueriesData<OrderSummary[]>({ queryKey: ['orders'] }, (old) =>
      old?.map((x) => (x.id === o.id ? { ...x, status } : x)))
    const { error } = await supabase.from('orders').update({
      status, delivered_at: status === 'delivered' ? new Date().toISOString() : null,
    }).eq('id', o.id)
    if (error) alert(error.message)
    qc.invalidateQueries()
  }

  const toggle = (s: string) => {
    const n = new Set(collapsed)
    n.has(s) ? n.delete(s) : n.add(s)
    setCollapsed(n)
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Board</h1>
      <DndContext sensors={sensors} onDragStart={(e) => setActiveId(String(e.active.id))}
        onDragCancel={() => setActiveId(null)} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 items-start">
          {STATUSES.map((s) => (
            <Column key={s} status={s} orders={data.filter((o) => o.status === s)}
              collapsed={collapsed.has(s)} toggle={() => toggle(s)} />
          ))}
        </div>
        {/* overlay floats above the scroll container, so the dragged card is never clipped */}
        <DragOverlay>{active ? <div className={`${cardCls} w-60 shadow-lg`}><CardBody o={active} /></div> : null}</DragOverlay>
      </DndContext>
    </div>
  )
}
