import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Wallet,
  MessagesSquare,
  FlaskConical,
  Settings,
  GraduationCap,
  LogOut,
  Inbox,
  Target,
  Ellipsis,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../store/auth.js';
import { cx } from './ui.jsx';

// `tab` = pinned to the phone's bottom bar; the rest live in the "more" sheet.
const TEACHER_NAV = [
  { to: '/', label: 'لوحة التحكم', short: 'الرئيسية', icon: LayoutDashboard, end: true, tab: true },
  { to: '/courses', label: 'الكورسات والدروس', short: 'الكورسات', icon: BookOpen, tab: true },
  { to: '/students', label: 'الطلاب', short: 'الطلاب', icon: Users, tab: true },
  { to: '/requests', label: 'طلبات الاشتراك', short: 'الطلبات', icon: Inbox, badge: 'requests', tab: true },
  { to: '/payments', label: 'الماليات', icon: Wallet },
  { to: '/questions', label: 'أسئلة الطلاب', icon: MessagesSquare },
  { to: '/sandbox', label: 'الملعب', icon: FlaskConical },
  { to: '/settings', label: 'الإعدادات', icon: Settings },
];

const STUDENT_NAV = [
  { to: '/', label: 'كورساتي', short: 'كورساتي', icon: GraduationCap, end: true, tab: true },
  { to: '/skills', label: 'خريطة مهاراتي', short: 'مهاراتي', icon: Target, tab: true },
  { to: '/my-questions', label: 'أسئلتي', short: 'أسئلتي', icon: MessagesSquare, tab: true },
  { to: '/sandbox', label: 'ملعبي', short: 'الملعب', icon: FlaskConical, tab: true },
];

export function Logo({ name, compact }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-[#8f74ff] font-mono text-sm font-bold text-white shadow-lg shadow-brand/30">
        {'</>'}
      </div>
      {!compact && <span className="text-lg font-bold tracking-tight">{name}</span>}
    </div>
  );
}

function Badge({ n, className }) {
  return n > 0 ? <span className={cx('rounded-full bg-rose px-1.5 text-[10px] leading-4 font-semibold text-white', className)}>{n}</span> : null;
}

/* Desktop: full sidebar. Tablet: icon rail. Phone: top bar + bottom tabs + a "more" sheet. */
export default function Layout() {
  const { user, logout, platform } = useAuth();
  const [sheet, setSheet] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);
  const { pathname } = useLocation();
  const mainRef = useRef(null);
  const isTeacher = user.role === 'teacher';
  const nav = isTeacher ? TEACHER_NAV : STUDENT_NAV;
  const tabs = nav.filter((item) => item.tab);
  const more = nav.filter((item) => !item.tab);
  const badges = { requests: pendingRequests };

  // Refresh the "requests waiting" badge on every page change.
  useEffect(() => {
    if (!isTeacher) return;
    api
      .get('/requests?status=pending')
      .then((list) => setPendingRequests(list.length))
      .catch(() => {});
  }, [isTeacher, pathname]);

  // Each page starts at the top, like a native app screen, and the sheet closes.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    setSheet(false);
  }, [pathname]);

  useEffect(() => {
    if (!sheet) return undefined;
    const onKey = (e) => e.key === 'Escape' && setSheet(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheet]);

  const moreActive = more.some((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)));

  return (
    <div className="flex h-full">
      {/* tablet rail + desktop sidebar */}
      <aside className="hidden h-full w-[84px] shrink-0 flex-col border-l border-line bg-panel/90 shadow-card backdrop-blur md:flex lg:w-64">
        <div className="flex items-center justify-center px-3 py-5 lg:justify-start lg:px-5">
          <div className="hidden lg:block">
            <Logo name={platform.platform_name} />
          </div>
          <div className="lg:hidden">
            <Logo compact />
          </div>
        </div>
        <nav className="flex-1 space-y-1.5 overflow-y-auto px-3">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              className={({ isActive }) =>
                cx(
                  'group relative flex items-center gap-3 rounded-2xl px-2.5 py-2 text-sm transition md:justify-center lg:justify-start',
                  isActive ? 'bg-brand/10 font-semibold text-brand' : 'text-muted hover:bg-panel-2 hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cx('flex size-9 shrink-0 items-center justify-center rounded-xl transition', isActive ? 'bg-white shadow-sm shadow-brand/20' : 'bg-panel-2 group-hover:bg-white')}>
                    <item.icon className="size-[18px]" />
                  </span>
                  <span className="hidden lg:inline">{item.label}</span>
                  {item.badge && (
                    <>
                      <Badge n={badges[item.badge]} className="mr-auto hidden lg:inline" />
                      {badges[item.badge] > 0 && <span className="absolute top-1.5 right-2 size-2.5 rounded-full bg-rose ring-2 ring-white lg:hidden" />}
                    </>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line p-3">
          <div className="flex items-center gap-3 rounded-2xl px-1 py-2 md:flex-col lg:flex-row lg:px-2">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-bold text-brand">{user.name.slice(0, 1)}</div>
            <div className="hidden min-w-0 flex-1 lg:block">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted">{isTeacher ? 'المدرّس' : 'طالب'}</p>
            </div>
            <button onClick={logout} title="تسجيل الخروج" className="rounded-xl p-2 text-muted transition hover:bg-rose/10 hover:text-rose">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* phone top bar */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-panel/90 px-4 pt-[max(0.6rem,env(safe-area-inset-top))] pb-2.5 backdrop-blur md:hidden">
          <Logo name={platform.platform_name} />
          <button
            onClick={() => setSheet(true)}
            aria-label="حسابي والمزيد"
            className="flex size-10 items-center justify-center rounded-full bg-brand/10 text-sm font-bold text-brand active:scale-95"
          >
            {user.name.slice(0, 1)}
          </button>
        </header>

        <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth">
          <div key={pathname} className="mx-auto max-w-7xl animate-page px-4 pt-4 pb-[calc(6.25rem+env(safe-area-inset-bottom))] md:px-6 md:pt-6 md:pb-8 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>

        {/* phone bottom tabs */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_-18px_rgb(76_63_170/0.35)] backdrop-blur md:hidden">
          <ul className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${tabs.length + (more.length ? 1 : 0)}, minmax(0, 1fr))` }}>
            {tabs.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className="relative flex flex-col items-center gap-0.5 px-1 pt-2 pb-1.5 text-[11px] font-medium active:scale-95">
                  {({ isActive }) => (
                    <>
                      <span className={cx('flex h-8 w-14 items-center justify-center rounded-full transition', isActive ? 'bg-brand/12 text-brand' : 'text-muted')}>
                        <item.icon className="size-5" />
                      </span>
                      <span className={isActive ? 'text-brand' : 'text-muted'}>{item.short}</span>
                      {item.badge && badges[item.badge] > 0 && <Badge n={badges[item.badge]} className="absolute top-1 right-[calc(50%-1.9rem)] ring-2 ring-white" />}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
            {more.length > 0 && (
              <li>
                <button onClick={() => setSheet(true)} className="flex w-full flex-col items-center gap-0.5 px-1 pt-2 pb-1.5 text-[11px] font-medium active:scale-95">
                  <span className={cx('flex h-8 w-14 items-center justify-center rounded-full transition', moreActive ? 'bg-brand/12 text-brand' : 'text-muted')}>
                    <Ellipsis className="size-5" />
                  </span>
                  <span className={moreActive ? 'text-brand' : 'text-muted'}>المزيد</span>
                </button>
              </li>
            )}
          </ul>
        </nav>
      </div>

      {sheet && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="القائمة">
          <div className="absolute inset-0 animate-fade bg-slate-900/40 backdrop-blur-[2px]" onClick={() => setSheet(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] animate-sheet overflow-y-auto rounded-t-3xl border-t border-line bg-panel px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-float">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line" />
            <div className="mb-4 flex items-center gap-3 rounded-2xl bg-panel-2 p-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-brand/10 text-lg font-bold text-brand">{user.name.slice(0, 1)}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{user.name}</p>
                <p className="text-xs text-muted">{isTeacher ? 'المدرّس' : 'طالب'}</p>
              </div>
            </div>
            {more.length > 0 && (
              <div className="mb-3 grid grid-cols-2 gap-2.5">
                {more.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cx('flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-medium active:scale-[0.98]', isActive ? 'border-brand/40 bg-brand/10 text-brand' : 'border-line bg-panel')
                    }
                  >
                    <item.icon className="size-5" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )}
            <button onClick={logout} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose/30 bg-rose/10 py-3 text-sm font-medium text-rose active:scale-[0.98]">
              <LogOut className="size-4" /> تسجيل الخروج
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
