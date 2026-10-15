import { PlantIcon } from '@phosphor-icons/react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
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
import DepartmentDetail from './pages/DepartmentDetail.jsx';
import NotFound from './pages/NotFound.jsx';
import Leave from './pages/Leave.jsx';
import Attendance from './pages/Attendance.jsx';
import Holidays from './pages/Holidays.jsx';

const WHAT = {
  dashboard: 'your dashboard', employees: 'the employee directory', profile: 'this profile', departments: 'departments',
  department: 'this department', leave: 'leave requests', attendance: 'attendance', holidays: 'holidays', notfound: 'Fellow',
};

function ProfileRoute() {
  const { id } = useParams();
  return <Profile key={id} />;
}

function DepartmentRoute() {
  const { id } = useParams();
  return <DepartmentDetail key={id} />;
}

function titles(route, byId, departments) {
  const person = byId.get(route.id);
  const dept = departments.find((d) => d.id === route.id);
  return {
    dashboard: ['Dashboard', 'Overview'],
    employees: ['Employees', 'People'],
    profile: [person ? fullName(person) : 'Profile', 'Employees / Profile'],
    departments: ['Departments', 'Organisation'],
    department: [dept ? dept.name : 'Department', 'Organisation / Department'],
    notfound: ['Page not found', 'Fellow'],
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
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/employees" element={<Employees />} />
      <Route path="/employees/:id" element={<ProfileRoute />} />
      <Route path="/employees/:id/:tab" element={<ProfileRoute />} />
      <Route path="/departments" element={<Departments />} />
      <Route path="/departments/:id" element={<DepartmentRoute />} />
      <Route path="/leave" element={<Leave />} />
      <Route path="/leave/:tab" element={<Leave />} />
      <Route path="/attendance" element={<Attendance />} />
      <Route path="/holidays" element={<Holidays />} />
      <Route path="/dashboard" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  const { route, byId, core } = useApp();
  const [title, crumb] = titles(route, byId, core.departments);
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
