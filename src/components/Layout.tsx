import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

const links = [
  ['/', 'Home'], ['/orders', 'Orders'], ['/board', 'Board'],
  ['/calendar', 'Calendar'], ['/customers', 'Customers'], ['/settings', 'Settings'],
] as const

export default function Layout() {
  const { pathname } = useLocation()
  const cls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center justify-center min-h-[44px] px-1 text-xs md:text-sm md:justify-start md:px-4 md:rounded-lg ${
      isActive ? 'text-indigo-600 font-semibold md:bg-indigo-50' : 'text-slate-600'
    }`
  return (
    <div className="md:flex min-h-screen">
      <nav className="fixed bottom-0 inset-x-0 z-20 bg-white border-t grid grid-cols-6 pb-[env(safe-area-inset-bottom)]
                      md:static md:w-52 md:border-t-0 md:border-r md:flex md:flex-col md:gap-1 md:p-3 md:shrink-0">
        <div className="hidden md:block text-xl font-bold px-4 py-3">OrderDesk</div>
        <Link to="/orders/new" className="hidden md:flex items-center min-h-[44px] px-4 mb-2 rounded-lg bg-indigo-600 text-white font-medium">
          + New order
        </Link>
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/'} className={cls}>{label}</NavLink>
        ))}
      </nav>
      <main className="flex-1 min-w-0 p-4 pb-28 md:pb-4">
        <Outlet />
      </main>
      {pathname !== '/orders/new' && (
        <Link
          to="/orders/new" aria-label="New order"
          className="md:hidden fixed right-4 z-30 w-14 h-14 rounded-full bg-indigo-600 text-white text-3xl shadow-lg flex items-center justify-center"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 4rem)' }}
        >
          +
        </Link>
      )}
    </div>
  )
}
