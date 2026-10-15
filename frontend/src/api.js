export class ApiError extends Error {
  constructor(message, status, path) {
    super(message);
    this.status = status;
    this.path = path;
  }
}

function describe(detail) {
  if (!detail) return null;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => (d.loc ? `${d.loc.filter((p) => p !== 'body').join('.')}: ${d.msg}` : d.msg)).join('; ');
  }
  return JSON.stringify(detail);
}

function query(params) {
  const entries = Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.length ? `?${new URLSearchParams(entries)}` : '';
}

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Could not reach the server', 0, path);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const fallback = res.status >= 500 ? 'The server could not complete this request' : res.statusText;
    throw new ApiError(describe(data?.detail) || fallback, res.status, path);
  }
  return data;
}

const get = (path, params) => request('GET', path + query(params));
const post = (path, body = {}) => request('POST', path, body);
const put = (path, body) => request('PUT', path, body);
const del = (path) => request('DELETE', path);

export const getDashboardStats = () => get('/api/dashboard/stats');

export const listEmployees = (filters) => get('/api/employees', filters);
export const getEmployee = (id) => get(`/api/employees/${id}`);
export const createEmployee = (data) => post('/api/employees', data);
export const updateEmployee = (id, data) => put(`/api/employees/${id}`, data);
export const deleteEmployee = (id) => del(`/api/employees/${id}`);
export const getDirectReports = (id) => get(`/api/employees/${id}/reports`);
export const getLeaveBalance = (id, year) => get(`/api/employees/${id}/leave-balance`, { year });

export const listDepartments = () => get('/api/departments');
export const getDepartment = (id) => get(`/api/departments/${id}`);
export const createDepartment = (data) => post('/api/departments', data);
export const updateDepartment = (id, data) => put(`/api/departments/${id}`, data);
export const deleteDepartment = (id) => del(`/api/departments/${id}`);

export const listLeaveTypes = () => get('/api/leave-types');
export const listLeaves = (filters) => get('/api/leaves', filters);
export const applyLeave = (data) => post('/api/leaves', data);
export const approveLeave = (id, approverId, comment) =>
  post(`/api/leaves/${id}/approve`, { approver_id: approverId, comment: comment || null });
export const rejectLeave = (id, approverId, comment) =>
  post(`/api/leaves/${id}/reject`, { approver_id: approverId, comment: comment || null });
export const cancelLeave = (id) => post(`/api/leaves/${id}/cancel`);

export const getAttendanceBoard = (date, departmentId) =>
  get('/api/attendance', { date, department_id: departmentId });
export const getAttendanceForDay = (employeeId, date) => get('/api/attendance', { employee_id: employeeId, date });
export const getAttendanceMonth = (employeeId, month) => get('/api/attendance', { employee_id: employeeId, month });
export const checkIn = (employeeId) => post('/api/attendance/check-in', { employee_id: employeeId });
export const checkOut = (employeeId) => post('/api/attendance/check-out', { employee_id: employeeId });

export const listHolidays = (year) => get('/api/holidays', { year });
export const createHoliday = (data) => post('/api/holidays', data);
export const deleteHoliday = (id) => del(`/api/holidays/${id}`);
