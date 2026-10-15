import { PlantIcon } from '@phosphor-icons/react';
import { useApp } from './state.jsx';
import { fullName } from './lib/ui.js';
import { todayISO } from './lib/dates.js';
import { Sidebar, Toasts, Topbar } from './components/Shell.jsx';
import { EmptyState, ErrorState, Skeleton } from './components/common.jsx';
import { ModalHost } from './components/modals.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Employees from './pages/Employees.jsx';
import Profile from './pages/Profile.jsx';
import Departments from './pages/Departments.jsx';
import Leave from './pages/Leave.jsx';
import Attendance from './pages/Attendance.jsx';
import Holidays from './pages/Holidays.jsx';

const PAGES = { dashboard: Dashboard, employees: Employees, profile: Profile, departments: Departments, leave: Leave, attendance: Attendance, holidays: Holidays };
const WHAT = {
  dashboard: 'your dashboard', employees: 'the employee directory', profile: 'this profile', departments: 'departments',
  leave: 'leave requests', attendance: 'attendance', holidays: 'holidays',
};

function titles(route, byId) {
  const person = byId.get(route.id);
  return {
    dashboard: ['Dashboard', 'Overview'],
    employees: ['Employees', 'People'],
    profile: [person ? fullName(person) : 'Profile', 'Employees / Profile'],
    departments: ['Departments', 'Organisation'],
    leave: ['Leave', 'Time off'],
    attendance: ['Attendance', 'Time tracking'],
    holidays: [`Holidays ${todayISO().slice(0, 4)}`, 'Company calendar'],
  }[route.page];
}

function Main() {
  const { route, core, loadCore, viewer, openModal } = useApp();
  if (core.status === 'error') return <ErrorState error={core.error} what={WHAT[route.page]} onRetry={() => loadCore(false)} />;
  if (core.status === 'loading') return <Skeleton variant={route.page === 'dashboard' ? 'dashboard' : 'list'} />;
  if (!viewer) {
    return (
      <EmptyState
        Icon={PlantIcon}
        title="Your workspace is ready"
        body="Add your first people and departments to see headcount, attendance and leave at a glance."
        cta="Add employee"
        onCta={() => openModal('employee')}
      />
    );
  }
  const Page = PAGES[route.page];
  return <Page key={route.page === 'profile' ? `profile-${route.id}` : route.page} />;
}

export default function App() {
  const { route, byId } = useApp();
  const [title, crumb] = titles(route, byId);
  return (
    <div className="app">
      <Sidebar />
      <div className="main-col">
        <Topbar title={title} crumb={crumb} />
        <main className="main">
          <Main />
        </main>
      </div>
      <ModalHost />
      <Toasts />
    </div>
  );
}
