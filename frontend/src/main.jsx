import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

async function get(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || res.statusText);
  return res.json();
}

function App() {
  const [stats, setStats] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState(null);

  const load = () => {
    setError(null);
    Promise.all([get('/api/dashboard/stats'), get('/api/employees')])
      .then(([s, e]) => { setStats(s); setEmployees(e); })
      .catch((err) => setError(err.message));
  };
  useEffect(load, []);

  if (error) {
    return (
      <main className="page">
        <p className="error">Cannot reach the server: {error}</p>
        <button onClick={load}>Retry</button>
      </main>
    );
  }
  if (!stats) return <main className="page"><p>Loading...</p></main>;

  const kpis = [
    ['Employees', stats.total_employees],
    ['Present today', stats.present_today],
    ['On leave today', stats.on_leave_today],
    ['Pending leave', stats.pending_leaves],
  ];

  return (
    <main className="page">
      <h1>AppName</h1>
      <section className="kpis">
        {kpis.map(([label, value]) => (
          <div className="kpi" key={label}><span>{label}</span><strong>{value}</strong></div>
        ))}
      </section>
      <table>
        <thead><tr><th>Code</th><th>Name</th><th>Department</th><th>Designation</th><th>Status</th></tr></thead>
        <tbody>
          {employees.map((e) => (
            <tr key={e.id}>
              <td>{e.employee_code}</td>
              <td>{e.first_name} {e.last_name}</td>
              <td>{e.department_name}</td>
              <td>{e.designation}</td>
              <td>{e.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
