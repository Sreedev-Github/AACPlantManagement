import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  DollarSign,
  Download,
  Eye,
  Factory,
  FileSpreadsheet,
  FileText,
  Fuel,
  History,
  LayoutGrid,
  Layers,
  LogOut,
  Pencil,
  Plus,
  ScrollText,
  ShieldCheck,
  Trash2,
  Truck,
  Users,
  Scale,
  X,
  Briefcase,
} from 'lucide-react';
import { Card, EditableCell, InputGroup, StatCard, StatusBadge } from '../ui/AppUI';
import { convertPiecesToCbm, formatTruckTypeShort, getVolumePerPieceFromSize, formatDateDisplay } from '../../utils/appHelpers';

const BRAND_LOGO_SRC = '/abc_logo.png';

const formatDieselMetric = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  const num = parseFloat(value);
  if (Number.isNaN(num)) return '-';
  return Number(num.toFixed(2)).toString();
};


const BrandLogo = ({ className = 'h-10 w-10', imageClassName = '' }) => (
  <img
    src={BRAND_LOGO_SRC}
    alt="ABC Ashpro"
    className={`${className} object-contain ${imageClassName}`.trim()}
    draggable="false"
  />
);

export const LoginView = ({ onLogin, loading, error }) => {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin({ username, password });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 space-y-6 border border-slate-200">
        <div className="text-center"><div className="bg-white w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-slate-200 shadow-xl p-2 border border-slate-100"><BrandLogo className="h-full w-full" /></div><h1 className="text-2xl font-bold text-slate-900">ABC ASHPRO</h1><p className="text-slate-500 mt-2">Sign in to continue</p></div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Username</label>
            <input type="text" required className="mt-1 w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter username" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Password</label>
            <input type="password" required className="mt-1 w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 p-2 rounded-lg">{error}</p>}
          <button type="submit" disabled={loading} className="w-full py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60">{loading ? 'Signing in...' : 'Login'}</button>
        </form>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
          <p className="font-bold text-slate-700">Team access</p>
          <p>Use your team username and the shared password.</p>
          <p>Roles: sale, loading, account, production, management.</p>
        </div>
      </div>
    </div>
  );
};

export const ManagementAccessView = ({ teamUsers, currentUser, onSaveUser, onRefreshUsers, loading }) => {
  const [selectedUserId, setSelectedUserId] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const tempUserPattern = /^(?:smoke|diag|debug)_loading_\d+$/i;

  const visibleUsers = React.useMemo(
    () => teamUsers.filter((item) => {
      const role = String(item.role || '').toLowerCase();
      const usernameValue = String(item.username || '').trim().toLowerCase();
      return ['sale', 'loading', 'account', 'production'].includes(role) && !tempUserPattern.test(usernameValue);
    }),
    [teamUsers],
  );

  const selectedUser = React.useMemo(
    () => visibleUsers.find((item) => String(item.id) === String(selectedUserId)) || null,
    [selectedUserId, visibleUsers],
  );

  React.useEffect(() => {
    if (!selectedUser && visibleUsers.length > 0) {
      setSelectedUserId(String(visibleUsers[0].id));
      return;
    }

    if (selectedUser) {
      setUsername(selectedUser.username || '');
      setPassword('');
      setCurrentPassword('');
    }
  }, [selectedUser, visibleUsers]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    setSaving(true);
    try {
      await onSaveUser(selectedUser.id, {
        username: username.trim().toLowerCase(),
        password,
        currentPassword,
      });
      await onRefreshUsers(currentUser?.role || 'management');
      setPassword('');
      setCurrentPassword('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Users className="w-5 h-5 text-purple-600" /> Management Access</h2>
          <p className="text-xs text-slate-400">Update team usernames and passwords.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="p-4 border border-slate-200 bg-white">
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Team Users</div>
          <div className="space-y-2">
            {loading ? (
              <div className="text-sm text-slate-500">Loading users...</div>
            ) : visibleUsers.length === 0 ? (
              <div className="text-sm text-slate-500">No editable users found.</div>
            ) : visibleUsers.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => setSelectedUserId(String(user.id))}
                className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${String(selectedUserId) === String(user.id) ? 'border-purple-200 bg-purple-50' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <div className="font-semibold text-slate-900">{user.username}</div>
                <div className="text-xs uppercase tracking-wider text-slate-400">{user.role}</div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-4 border border-slate-200 bg-white">
          <div className="mb-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Selected User</div>
            <h3 className="mt-1 text-xl font-bold text-slate-900">{selectedUser ? selectedUser.username : 'No user selected'}</h3>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <InputGroup label="Username">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
              />
            </InputGroup>
            <InputGroup label="New Password">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
              />
            </InputGroup>
            <InputGroup label="Current Password">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
              />
            </InputGroup>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={!selectedUser || saving}
                className="w-full rounded-lg bg-purple-600 px-4 py-2.5 font-bold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export const AppHeader = ({
  role,
  setViewAndFilter,
  view,
  filterMode,
  viewDate,
  getTodayString,
  setEditingOrderId,
  setFormData,
  setView,
  onLogout,
  SIZES,
}) => (
  <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
    <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
      <div className="flex items-center space-x-2 cursor-pointer shrink-0" onClick={() => setViewAndFilter('home', 'date')}>
        <div className="bg-white p-1.5 rounded-lg shadow-sm border border-slate-100"><BrandLogo className="h-5 w-5" /></div><span className="font-bold text-slate-800 hidden md:block">AAC Manager</span><span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-xs font-medium uppercase border border-slate-200">{role}</span>
      </div>
      <div className="flex-1"></div>
      <div className="flex items-center space-x-2 shrink-0">
        {['sale', 'management', 'loading'].includes(role) && view === 'daily-log' && filterMode === 'date' && (role === 'management' || role === 'loading' || viewDate >= getTodayString()) && (<button onClick={() => { setEditingOrderId(null); setFormData({ invoiceId: '', client: '', location: '', gstin: '', vehicle: '', vehicleType: '', transporter: '', size: SIZES[3], quantityUnit: 'CBM', quantityValue: '', cbm: '', bjm: '', rate: '', bjmRate: '', aacRateManualOverride: false, bjmRateManualOverride: false, additionalProducts: [] }); setView('new-order'); }} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center shadow-sm whitespace-nowrap"><Plus className="w-4 h-4 md:mr-1.5" /> <span className="hidden md:inline">New Order</span></button>)}
        <button onClick={onLogout} className="text-slate-400 hover:text-red-500 p-2"><LogOut className="w-5 h-5" /></button>
      </div>
    </div>
  </header>
);

export const HomeView = ({ role, stats, setViewAndFilter, getTodayString, setView, setProductionTab, setViewDate, setEditingOrderId, setFormData, setFilterMode, SIZES }) => (
  <div className="space-y-8 animate-in fade-in duration-500">
    <div><h2 className="text-2xl font-bold text-slate-800">Welcome back, {String(role || 'user').toUpperCase()}</h2><p className="text-slate-500">Activity Overview</p></div>
    {role === 'sale' && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard onClick={() => setViewAndFilter('daily-log', 'date', getTodayString())} label="Today's Orders" value={stats.todayOrders} icon={Calendar} colorClass="bg-blue-500" />
        <StatCard onClick={() => setViewAndFilter('daily-log', 'active')} label="Active Loads" value={stats.active} icon={Truck} colorClass="bg-orange-500" />
        <StatCard onClick={() => setViewAndFilter('daily-log', 'approval')} label="Inv. To Approve" value={stats.pendingApprove} icon={ShieldCheck} colorClass="bg-green-500" />
        <StatCard onClick={() => setViewAndFilter('daily-log', 'backlog')} label="Backlog" value={stats.backlog} icon={AlertTriangle} colorClass="bg-red-500" />
      </div>
    )}
    {role === 'loading' && (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard onClick={() => setViewAndFilter('daily-log', 'date', getTodayString())} label="Today's Orders" value={stats.todayOrders} icon={Calendar} colorClass="bg-blue-500" />
        <StatCard onClick={() => setViewAndFilter('daily-log', 'active')} label="Active Loads" value={stats.active} icon={Truck} colorClass="bg-orange-500" />
        <StatCard onClick={() => setViewAndFilter('daily-log', 'backlog')} label="Backlog" value={stats.backlog} icon={AlertTriangle} colorClass="bg-red-500" />
      </div>
    )}
    {role === 'account' && (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard onClick={() => setViewAndFilter('daily-log', 'date', getTodayString())} label="Today's Orders" value={stats.todayOrders} icon={Calendar} colorClass="bg-blue-500" />
        <StatCard onClick={() => setViewAndFilter('daily-log', 'pending_invoice')} label="Pending Invoices" value={stats.pendingInv} icon={FileText} colorClass="bg-red-500" />
      </div>
    )}
    {role === 'production' && (
      <div className="grid md:grid-cols-2 gap-4">
        <Card onClick={() => { setView('production-dashboard'); setProductionTab('raw-material'); }} className="p-6 flex items-center justify-between group cursor-pointer"><div><div className="flex items-center mb-2"><Layers className="w-5 h-5 text-cyan-600 mr-2" /><span className="font-bold text-lg">Raw Material Stock</span></div><p className="text-sm text-slate-500">Manage raw material inventory.</p></div><ArrowRight className="text-slate-300 group-hover:text-cyan-600" /></Card>
        <Card onClick={() => { setView('production-dashboard'); setProductionTab('finished-stock'); }} className="p-6 flex items-center justify-between group cursor-pointer"><div><div className="flex items-center mb-2"><Boxes className="w-5 h-5 text-indigo-600 mr-2" /><span className="font-bold text-lg">Daily Production Report</span></div><p className="text-sm text-slate-500">Track finished goods & daily output.</p></div><ArrowRight className="text-slate-300 group-hover:text-indigo-600" /></Card>
      </div>
    )}
    {role === 'management' && (
      <>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard onClick={() => setViewAndFilter('daily-log', 'date', getTodayString())} label="Today's Activity" value={stats.todayOrders} icon={Calendar} colorClass="bg-purple-500" />
          <StatCard onClick={() => setViewAndFilter('daily-log', 'active')} label="Active Trucks" value={stats.active} icon={Truck} colorClass="bg-blue-500" />
          <StatCard onClick={() => setViewAndFilter('daily-log', 'pending_invoice')} label="Billing Pending" value={stats.pendingInv} icon={AlertCircle} colorClass="bg-red-500" />
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          <Card onClick={() => setViewAndFilter('daily-log', 'date', getTodayString())} className="p-6 flex items-center justify-between group cursor-pointer"><div><div className="flex items-center mb-2"><BarChart3 className="w-5 h-5 text-purple-600 mr-2" /><span className="font-bold text-lg">Daily Activity</span></div><p className="text-sm text-slate-500">View all dispatch records.</p></div><ArrowRight className="text-slate-300 group-hover:text-purple-600" /></Card>
          <Card onClick={() => setView('production-dashboard')} className="p-6 flex items-center justify-between group cursor-pointer"><div><div className="flex items-center mb-2"><Factory className="w-5 h-5 text-cyan-600 mr-2" /><span className="font-bold text-lg">Production Stock</span></div><p className="text-sm text-slate-500">Raw Material & Inventory.</p></div><ArrowRight className="text-slate-300 group-hover:text-cyan-600" /></Card>
          <Card onClick={() => setView('diesel-register')} className="p-6 flex items-center justify-between group cursor-pointer"><div><div className="flex items-center mb-2"><Fuel className="w-5 h-5 text-orange-600 mr-2" /><span className="font-bold text-lg">Diesel Register</span></div><p className="text-sm text-slate-500">Track HSD usage.</p></div><ArrowRight className="text-slate-300 group-hover:text-orange-600" /></Card>
          <Card onClick={() => setView('loading-report')} className="p-6 flex items-center justify-between group cursor-pointer"><div><div className="flex items-center mb-2"><ClipboardList className="w-5 h-5 text-blue-600 mr-2" /><span className="font-bold text-lg">Labor Report</span></div><p className="text-sm text-slate-500">Rates & remarks.</p></div><ArrowRight className="text-slate-300 group-hover:text-blue-600" /></Card>
          <Card onClick={() => setView('detailed-sales-report')} className="p-6 flex items-center justify-between group cursor-pointer"><div><div className="flex items-center mb-2"><FileSpreadsheet className="w-5 h-5 text-green-600 mr-2" /><span className="font-bold text-lg">Sales Report</span></div><p className="text-sm text-slate-500">Full details with Bill Amt.</p></div><ArrowRight className="text-slate-300 group-hover:text-green-600" /></Card>
          <Card onClick={() => setView('password-management')} className="p-6 flex items-center justify-between group cursor-pointer"><div><div className="flex items-center mb-2"><ShieldCheck className="w-5 h-5 text-purple-600 mr-2" /><span className="font-bold text-lg">Password Management</span></div><p className="text-sm text-slate-500">Update team account credentials.</p></div><ArrowRight className="text-slate-300 group-hover:text-purple-600" /></Card>
          <Card onClick={() => setView('system-logs')} className="p-6 flex items-center justify-between group cursor-pointer"><div><div className="flex items-center mb-2"><ScrollText className="w-5 h-5 text-slate-600 mr-2" /><span className="font-bold text-lg">System Logs</span></div><p className="text-sm text-slate-500">Audit trail of changes.</p></div><ArrowRight className="text-slate-300 group-hover:text-slate-600" /></Card>
        </div>
      </>
    )}
    {role === 'sale' && (
      <div className="grid md:grid-cols-3 gap-4 mt-8">
        <Card onClick={() => setViewAndFilter('daily-log', 'date', getTodayString())} className="p-6 flex items-center justify-between group cursor-pointer"><div><div className="flex items-center mb-2"><LayoutGrid className="w-5 h-5 text-blue-600 mr-2" /><span className="font-bold text-lg">Daily Loading Plan</span></div><p className="text-sm text-slate-500">Manage schedules & invoices.</p></div><ArrowRight className="text-slate-300 group-hover:text-blue-600" /></Card>
        <Card onClick={() => { setViewDate(getTodayString()); setFilterMode('date'); setEditingOrderId(null); setFormData({ invoiceId: '', client: '', location: '', gstin: '', vehicle: '', vehicleType: '', transporter: '', size: SIZES[3], quantityUnit: 'CBM', quantityValue: '', cbm: '', bjm: '', rate: '', bjmRate: '', aacRateManualOverride: false, bjmRateManualOverride: false, additionalProducts: [] }); setView('new-order'); }} className="p-6 flex items-center justify-between group cursor-pointer"><div><div className="flex items-center mb-2"><Plus className="w-5 h-5 text-green-600 mr-2" /><span className="font-bold text-lg">Create New Order</span></div><p className="text-sm text-slate-500">Add loading requirement.</p></div><ArrowRight className="text-slate-300 group-hover:text-green-600" /></Card>
        <Card onClick={() => { setView('production-dashboard'); setProductionTab('finished-stock'); }} className="p-6 flex items-center justify-between group cursor-pointer"><div><div className="flex items-center mb-2"><Boxes className="w-5 h-5 text-indigo-600 mr-2" /><span className="font-bold text-lg">Daily Production Report</span></div><p className="text-sm text-slate-500">View finished goods and daily output.</p></div><ArrowRight className="text-slate-300 group-hover:text-indigo-600" /></Card>
      </div>
    )}
    {role === 'loading' && (
      <div className="grid md:grid-cols-4 gap-4 mt-8">
        <Card onClick={() => setViewAndFilter('daily-log', 'date', getTodayString())} className="p-6 flex items-center justify-between group cursor-pointer"><div><div className="flex items-center mb-2"><LayoutGrid className="w-5 h-5 text-orange-600 mr-2" /><span className="font-bold text-lg">Daily Loading Log</span></div><p className="text-sm text-slate-500">Update truck status & dispatch.</p></div><ArrowRight className="text-slate-300 group-hover:text-orange-600" /></Card>
        <Card onClick={() => { setViewDate(getTodayString()); setFilterMode('date'); setEditingOrderId(null); setFormData({ invoiceId: '', client: '', location: '', gstin: '', vehicle: '', vehicleType: '', transporter: '', size: SIZES[3], quantityUnit: 'CBM', quantityValue: '', cbm: '', bjm: '', rate: '', bjmRate: '', aacRateManualOverride: false, bjmRateManualOverride: false, additionalProducts: [] }); setView('new-order'); }} className="p-6 flex items-center justify-between group cursor-pointer"><div><div className="flex items-center mb-2"><Plus className="w-5 h-5 text-green-600 mr-2" /><span className="font-bold text-lg">Create New Order</span></div><p className="text-sm text-slate-500">Add loading requirement.</p></div><ArrowRight className="text-slate-300 group-hover:text-green-600" /></Card>
        <Card onClick={() => setView('detailed-sales-report')} className="p-6 flex items-center justify-between group cursor-pointer"><div><div className="flex items-center mb-2"><FileSpreadsheet className="w-5 h-5 text-emerald-600 mr-2" /><span className="font-bold text-lg">Sales Report</span></div><p className="text-sm text-slate-500">View billing and dispatch details.</p></div><ArrowRight className="text-slate-300 group-hover:text-emerald-600" /></Card>
        <Card onClick={() => setView('diesel-register')} className="p-6 flex items-center justify-between group cursor-pointer"><div><div className="flex items-center mb-2"><Fuel className="w-5 h-5 text-orange-600 mr-2" /><span className="font-bold text-lg">Diesel Register</span></div><p className="text-sm text-slate-500">Track HSD usage.</p></div><ArrowRight className="text-slate-300 group-hover:text-orange-600" /></Card>
      </div>
    )}
    {role === 'account' && (
      <div className="grid md:grid-cols-2 gap-4 mt-8">
        <Card onClick={() => setViewAndFilter('daily-log', 'date', getTodayString())} className="p-6 flex items-center justify-between group cursor-pointer"><div><div className="flex items-center mb-2"><LayoutGrid className="w-5 h-5 text-green-600 mr-2" /><span className="font-bold text-lg">Loading & Billing</span></div><p className="text-sm text-slate-500">Upload tax invoices.</p></div><ArrowRight className="text-slate-300 group-hover:text-green-600" /></Card>
        <Card onClick={() => { setView('production-dashboard'); setProductionTab('finished-stock'); }} className="p-6 flex items-center justify-between group cursor-pointer"><div><div className="flex items-center mb-2"><Boxes className="w-5 h-5 text-indigo-600 mr-2" /><span className="font-bold text-lg">Daily Production Report</span></div><p className="text-sm text-slate-500">View finished goods and daily output.</p></div><ArrowRight className="text-slate-300 group-hover:text-indigo-600" /></Card>
      </div>
    )}
  </div>
);

export const ProductionDashboardView = ({
  handleDateChange,
  handleDownloadReport,
  productionTab,
  setProductionTab,
  viewDate,
  formatDateDisplay,
  getRawMaterialDataForDate,
  updateRawStock,
  calculateColumnTotal,
  getFinishedStockDataForDate,
  updateFinishedStock,
  updateMortarBag,
  updateProductionSummary,
  FINISHED_STOCK_SIZES,
  newFinishedSize,
  setNewFinishedSize,
  finishedSizeToRemove,
  setFinishedSizeToRemove,
  handleAddFinishedSize,
  handleRemoveFinishedSize,
  readOnly = false,
}) => {
  const rawData = getRawMaterialDataForDate(viewDate);
  const finishedData = getFinishedStockDataForDate(viewDate);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-slate-200">
        <button onClick={() => handleDateChange(-1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
        <div className="flex flex-col items-center">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Production Log</span>
          <span className="text-lg font-bold text-slate-800 flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-500" />{formatDateDisplay(viewDate)}</span>
        </div>
        <button onClick={handleDownloadReport} className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center shadow-sm"><Download className="w-4 h-4 mr-1.5" /> Download JPG</button>
        <button onClick={() => handleDateChange(1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"><ChevronRight className="w-5 h-5" /></button>
      </div>

      <div className="flex space-x-4 border-b border-slate-200 pb-1">
        <button onClick={() => setProductionTab('raw-material')} className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${productionTab === 'raw-material' ? 'bg-cyan-50 text-cyan-700 border-b-2 border-cyan-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>Raw Material Stock</button>
        <button onClick={() => setProductionTab('finished-stock')} className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${productionTab === 'finished-stock' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>Daily Production Report</button>
      </div>

      <div id="report-container" className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden px-6 pt-6 pb-12">
        {productionTab === 'raw-material' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex flex-col justify-between items-center text-center mb-6"><span className="font-extrabold text-lg text-cyan-900 mb-1">ABC ASHPRO</span><div className="w-full max-w-sm border-b-2 border-cyan-800 mb-2"></div><h3 className="font-bold text-cyan-800 text-lg">STATUS OF RAW MATERIAL</h3></div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full table-fixed text-xs md:text-sm text-center">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-xs">
                  <tr>
                    <th className="px-2 py-3 text-center w-[6%]">Sr</th>
                    <th className="px-2 py-3 text-center w-[28%]">Description</th>
                    <th className="px-2 py-3 text-center w-[9%]">Unit</th>
                    <th className="px-2 py-3 text-right w-[10%] bg-blue-50/50">Opening</th>
                    <th className="px-2 py-3 text-right w-[10%] bg-blue-50/50">Receipt</th>
                    <th className="px-2 py-3 text-right w-[10%] font-extrabold bg-blue-100/50">Total</th>
                    <th className="px-2 py-3 text-right w-[10%] bg-orange-50/50">Issue</th>
                    <th className="px-2 py-3 text-right w-[10%] font-extrabold bg-green-100/50">Closing</th>
                    <th className="px-2 py-3 text-center w-[17%]">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rawData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-2 py-2 text-slate-500 text-center">{idx + 1}</td>
                      <td className="px-2 py-2 font-bold text-slate-700 text-center whitespace-normal break-words">{item.desc}</td>
                      <td className="px-2 py-2 text-slate-500 text-[11px] text-center">{item.unit}</td>
                      <td className="px-2 py-2 text-right font-bold text-slate-900 bg-white">{item.opening.toFixed(2)}</td>
                      <td className="px-2 py-2"><EditableCell type="text" inputMode="decimal" className="text-right font-bold text-slate-700" value={item.receipt} onUpdate={(v) => updateRawStock(idx, 'receipt', v)} tableId="raw-material" rowIndex={idx} colIndex={0} readOnly={readOnly} /></td>
                      <td className="px-2 py-2 text-right font-bold text-blue-700 bg-blue-50/30">{item.total.toFixed(2)}</td>
                      <td className="px-2 py-2"><EditableCell type="text" inputMode="decimal" className="text-right font-bold text-slate-700" value={item.issue} onUpdate={(v) => updateRawStock(idx, 'issue', v)} tableId="raw-material" rowIndex={idx} colIndex={1} readOnly={readOnly} /></td>
                      <td className="px-2 py-2 text-right font-bold text-green-700 bg-green-50/30">{item.closing.toFixed(2)}</td>
                      <td className="px-2 py-2"><EditableCell type="text" value={item.remarks} className="font-bold text-slate-700 text-center whitespace-normal break-words" onUpdate={(v) => updateRawStock(idx, 'remarks', v)} tableId="raw-material" rowIndex={idx} colIndex={2} readOnly={readOnly} /></td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-bold text-slate-900">
                    <td colSpan="3" className="px-2 py-3 text-right text-[11px] uppercase">Total</td>
                    <td className="px-2 py-3 text-right bg-blue-100/50 text-slate-900">{calculateColumnTotal(rawData, 'opening')}</td>
                    <td className="px-2 py-3 text-right bg-blue-100/50">{calculateColumnTotal(rawData, 'receipt')}</td>
                    <td className="px-2 py-3 text-right bg-blue-200/50">{calculateColumnTotal(rawData, 'total')}</td>
                    <td className="px-2 py-3 text-right bg-orange-100/50">{calculateColumnTotal(rawData, 'issue')}</td>
                    <td className="px-2 py-3 text-right bg-green-200/50">{calculateColumnTotal(rawData, 'closing')}</td>
                    <td className="px-2 py-3"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {productionTab === 'finished-stock' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex flex-col justify-between items-center text-center mb-6"><span className="font-extrabold text-lg text-indigo-900 mb-1">ABC ASHPRO</span><div className="w-full max-w-sm border-b-2 border-indigo-800 mb-2"></div><h3 className="font-bold text-indigo-800 text-lg">FINISHED STOCK REPORT</h3></div>
            <div className="mb-4 grid gap-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <InputGroup label="Add Size">
                  <input
                    type="text"
                    value={newFinishedSize}
                    onChange={(e) => setNewFinishedSize(e.target.value)}
                    className="w-full rounded-lg border border-indigo-200 bg-white p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. 600X300X200"
                  />
                </InputGroup>
                <InputGroup label="Remove Size">
                  <select
                    value={finishedSizeToRemove}
                    onChange={(e) => setFinishedSizeToRemove(e.target.value)}
                    className="w-full rounded-lg border border-indigo-200 bg-white p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select size</option>
                    {(finishedData.sizes || FINISHED_STOCK_SIZES).map((sizeOption) => (
                      <option key={sizeOption} value={sizeOption}>{sizeOption}</option>
                    ))}
                  </select>
                </InputGroup>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={handleAddFinishedSize} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">Add Size</button>
                <button type="button" onClick={handleRemoveFinishedSize} className="rounded-lg border border-indigo-200 bg-white px-4 py-2.5 text-sm font-bold text-indigo-700 hover:bg-indigo-100">Delete Size</button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full table-fixed text-xs md:text-sm text-center">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-xs">
                  <tr>
                    <th className="px-2 py-3 text-center w-[6%]">SL</th>
                    <th className="px-2 py-3 text-center w-[16%]">Size</th>
                    <th className="px-2 py-3 text-right w-[9%] bg-blue-50/50">Opening</th>
                    <th className="px-2 py-3 text-right w-[9%] bg-green-50/50">Segregation</th>
                    <th className="px-2 py-3 text-right w-[9%] bg-orange-50/50">Sale</th>
                    <th className="px-2 py-3 text-right w-[10%] bg-red-50/50">Pro Rej.</th>
                    <th className="px-2 py-3 text-right w-[10%] bg-red-50/50">Load Rej.</th>
                    <th className="px-2 py-3 text-right w-[9%] bg-yellow-50/50">Self Use</th>
                    <th className="px-2 py-3 text-right w-[9%] bg-yellow-50/50">Self Use (BJM)</th>
                    <th className="px-2 py-3 text-right w-[9%] font-extrabold bg-indigo-100/50">Closing</th>
                    <th className="px-2 py-3 text-right w-[9%] bg-slate-100/70">In Autoclave</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {finishedData.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-2 py-2 text-slate-500 text-center">{idx + 1}</td>
                      <td className="px-2 py-2 font-bold text-slate-900 text-center text-[11px] whitespace-normal break-words">{item.size}</td>
                      <td className="px-2 py-2 text-right font-mono text-slate-900 bg-white">{item.opening.toFixed(2)}</td>
                      <td className="px-2 py-2"><EditableCell type="text" inputMode="decimal" className="text-right font-bold text-slate-700" value={item.segregation} onUpdate={(v) => updateFinishedStock(idx, 'segregation', v)} tableId="finished-stock" rowIndex={idx} colIndex={0} readOnly={readOnly} /></td>
                      <td className="px-2 py-2"><EditableCell type="text" inputMode="decimal" className="text-right font-bold text-slate-700" value={item.sale} onUpdate={(v) => updateFinishedStock(idx, 'sale', v)} tableId="finished-stock" rowIndex={idx} colIndex={1} readOnly={readOnly} /></td>
                      <td className="px-2 py-2"><EditableCell type="text" inputMode="decimal" className="text-right font-bold text-slate-700" value={item.proRejection} onUpdate={(v) => updateFinishedStock(idx, 'proRejection', v)} tableId="finished-stock" rowIndex={idx} colIndex={2} readOnly={readOnly} /></td>
                      <td className="px-2 py-2"><EditableCell type="text" inputMode="decimal" className="text-right font-bold text-slate-700" value={item.loadingRejection} onUpdate={(v) => updateFinishedStock(idx, 'loadingRejection', v)} tableId="finished-stock" rowIndex={idx} colIndex={3} readOnly={readOnly} /></td>
                      <td className="px-2 py-2"><EditableCell type="text" inputMode="decimal" className="text-right font-bold text-slate-700" value={item.selfUse} onUpdate={(v) => updateFinishedStock(idx, 'selfUse', v)} tableId="finished-stock" rowIndex={idx} colIndex={4} readOnly={readOnly} /></td>
                      <td className="px-2 py-2"><EditableCell type="text" inputMode="decimal" className="text-right font-bold text-slate-700" value={item.selfUseBjm} onUpdate={(v) => updateFinishedStock(idx, 'selfUseBjm', v)} tableId="finished-stock" rowIndex={idx} colIndex={5} readOnly={readOnly} /></td>
                      <td className="px-2 py-2 text-right font-bold text-indigo-700 bg-indigo-50/30">{item.closing.toFixed(2)}</td>
                      <td className="px-2 py-2"><EditableCell type="text" inputMode="decimal" className="text-right font-bold text-slate-700" value={item.inAutoclave} onUpdate={(v) => updateFinishedStock(idx, 'inAutoclave', v)} tableId="finished-stock" rowIndex={idx} colIndex={6} readOnly={readOnly} /></td>
                    </tr>
                  ))}
                  <tr className="bg-slate-200 font-bold text-slate-900 border-t-2 border-slate-300">
                    <td colSpan="2" className="px-2 py-3 text-right text-[11px] uppercase">TOTAL (CBM)</td>
                    <td className="px-2 py-3 text-right bg-blue-200/50 text-slate-900">{calculateColumnTotal(finishedData.items, 'opening')}</td>
                    <td className="px-2 py-3 text-right bg-green-200/50">{calculateColumnTotal(finishedData.items, 'segregation')}</td>
                    <td className="px-2 py-3 text-right bg-orange-200/50">{calculateColumnTotal(finishedData.items, 'sale')}</td>
                    <td className="px-2 py-3 text-right bg-red-200/50">{calculateColumnTotal(finishedData.items, 'proRejection')}</td>
                    <td className="px-2 py-3 text-right bg-red-200/50">{calculateColumnTotal(finishedData.items, 'loadingRejection')}</td>
                    <td className="px-2 py-3 text-right bg-yellow-200/50">{calculateColumnTotal(finishedData.items, 'selfUse')}</td>
                    <td className="px-2 py-3 text-right bg-yellow-200/50">{calculateColumnTotal(finishedData.items, 'selfUseBjm')}</td>
                    <td className="px-2 py-3 text-right bg-indigo-300/50">{calculateColumnTotal(finishedData.items, 'closing')}</td>
                    <td className="px-2 py-3 text-right bg-slate-200/70">{calculateColumnTotal(finishedData.items, 'inAutoclave')}</td>
                  </tr>
                  <tr className="bg-yellow-50 font-bold border-t border-yellow-200">
                    <td className="px-2 py-3 text-center text-yellow-700">1</td>
                    <td className="px-2 py-3 text-center text-yellow-900">MORTAR (BAG)</td>
                    <td className="px-2 py-3 text-right font-mono text-slate-900 bg-yellow-100/50">{finishedData.mortarBag.opening}</td>
                    <td className="px-2 py-3"><EditableCell type="text" inputMode="decimal" className="text-right bg-white/50 font-bold text-slate-700" value={finishedData.mortarBag.receipt} onUpdate={(v) => updateMortarBag('receipt', v)} tableId="finished-stock" rowIndex={(finishedData.sizes || FINISHED_STOCK_SIZES).length} colIndex={0} readOnly={readOnly} /></td>
                    <td className="px-2 py-3"><EditableCell type="text" inputMode="decimal" className="text-right bg-white/50 font-bold text-slate-700" value={finishedData.mortarBag.sale} onUpdate={(v) => updateMortarBag('sale', v)} tableId="finished-stock" rowIndex={(finishedData.sizes || FINISHED_STOCK_SIZES).length} colIndex={1} readOnly={readOnly} /></td>
                    <td colSpan="4" className="px-2 py-3 text-center text-[11px] text-slate-400 italic bg-yellow-50/50">N/A</td>
                    <td className="px-2 py-3 text-right text-indigo-700 font-extrabold bg-yellow-100/50">{finishedData.mortarBag.closing}</td>
                    <td className="px-2 py-3 text-center text-slate-400 italic bg-yellow-50/50">-</td>
                  </tr>
                </tbody>
              </table>

              <div className="p-4 md:p-6 bg-white border-t border-slate-200 mt-4">
                <div className="flex flex-col lg:flex-row justify-between items-start gap-6 mb-6">
                  <div className="w-full lg:w-1/2 border border-slate-300">
                    <div className="flex bg-slate-100 border-b border-slate-300 text-xs font-bold"><div className="flex-1 p-2 border-r border-slate-300">SALE</div><div className="w-24 p-2 border-r border-slate-300 text-center">CBM</div><div className="w-32 p-2 text-right bg-orange-50 font-bold text-slate-800">{finishedData.summary.saleDaily}</div></div>
                    <div className="flex border-b border-slate-300 text-xs font-bold"><div className="flex-1 p-2 border-r border-slate-300">TOTAL SALE</div><div className="w-24 p-2 border-r border-slate-300 text-center">CBM</div><div className="w-32 p-0 bg-white"><EditableCell type="text" inputMode="decimal" className="text-right font-bold h-full text-slate-800" value={finishedData.summary.totalSale} onUpdate={(v) => updateProductionSummary('totalSale', v)} readOnly={readOnly} /></div></div>
                    <div className="flex text-xs font-bold bg-yellow-50"><div className="flex-1 p-2 border-r border-slate-300">TOTAL MORTAR SALE</div><div className="w-24 p-2 border-r border-slate-300 text-center">BAGS</div><div className="w-32 p-0"><EditableCell type="text" inputMode="decimal" className="text-right font-bold h-full bg-transparent text-slate-800" value={finishedData.summary.totalMortarSale} onUpdate={(v) => updateProductionSummary('totalMortarSale', v)} readOnly={readOnly} /></div></div>
                  </div>

                  <div className="w-full lg:w-1/2 border border-slate-300">
                    <div className="flex bg-slate-100 border-b border-slate-300 text-xs font-bold"><div className="flex-1 p-2 border-r border-slate-300">PRODUCTION</div><div className="w-24 p-2 border-r border-slate-300 text-center">CBM</div><div className="w-32 p-0 bg-white"><EditableCell type="text" inputMode="decimal" className="text-right font-bold h-full bg-transparent text-slate-800" value={finishedData.summary.productionDaily} onUpdate={(v) => updateProductionSummary('productionDaily', v)} readOnly={readOnly} /></div></div>
                    <div className="flex text-xs font-bold"><div className="flex-1 p-2 border-r border-slate-300">TOTAL PRODUCTION</div><div className="w-24 p-2 border-r border-slate-300 text-center">CBM</div><div className="w-32 p-0 bg-white"><EditableCell type="text" inputMode="decimal" className="text-right font-bold h-full text-slate-800" value={finishedData.summary.totalProduction} onUpdate={(v) => updateProductionSummary('totalProduction', v)} readOnly={readOnly} /></div></div>
                  </div>
                </div>

                <div className="flex justify-between items-end pt-12 pb-4 text-sm font-bold text-slate-800">
                  <div className="flex flex-col gap-2"><span className="underline decoration-2 underline-offset-4">Prepared by</span></div>
                  <div className="flex flex-col gap-2"><span className="underline decoration-2 underline-offset-4">Checked by</span></div>
                  <div className="flex flex-col gap-2"><span className="underline decoration-2 underline-offset-4">Approved by</span></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const SystemLogsView = ({ logs, formatDateTimeDisplay }) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200"><div><h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><History className="w-5 h-5 text-slate-600" /> System Audit Logs</h2><p className="text-xs text-slate-400">Real-time activity tracking.</p></div></div>
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm text-center"><thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs"><tr><th className="px-4 py-3 text-center">Time</th><th className="px-4 py-3 text-center">Team</th><th className="px-4 py-3 text-center">Action</th><th className="px-4 py-3 text-center">Details</th></tr></thead><tbody className="divide-y divide-slate-100">{logs.map((log) => (<tr key={log.id} className="hover:bg-slate-50"><td className="px-4 py-2 text-slate-500 whitespace-nowrap text-xs text-center">{formatDateTimeDisplay(log.timestamp)}</td><td className="px-4 py-2 font-bold text-slate-700 text-xs text-center">{log.team}</td><td className="px-4 py-2 text-center"><span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">{log.action}</span></td><td className="px-4 py-2 text-slate-600 text-center">{log.details}</td></tr>))}</tbody></table></div></div>
  </div>
);

export const LoadingReportView = ({ getLoadingReportData, updateEntry, updateTruckTypeAndRates, toggleGS, safeInt }) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200"><div><h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><ClipboardList className="w-5 h-5 text-blue-600" /> Loading & Unloading Report</h2><p className="text-xs text-slate-400">Labor and Rates tracking for dispatched orders</p></div></div>
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm text-center"><thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs"><tr><th className="px-4 py-3 text-center">Date</th><th className="px-4 py-3 text-center">Client</th><th className="px-4 py-3 text-center">Vehicle</th><th className="px-4 py-3 text-center">Type</th><th className="px-4 py-3 text-center w-12">GS</th><th className="px-4 py-3 text-center">Loading By</th><th className="px-4 py-3 w-24 text-center">Load Rate</th><th className="px-4 py-3 text-center">Unloading By</th><th className="px-4 py-3 w-24 text-center">Unload Rate</th><th className="px-4 py-3 text-center">Remarks</th></tr></thead><tbody className="divide-y divide-slate-100">{getLoadingReportData().map((order) => (<tr key={order.id} className="hover:bg-slate-50 transition-colors"><td className="px-4 py-3 text-center"><EditableCell value={order.orderDate} type="date" onUpdate={(v) => updateEntry('orders', order.id, 'orderDate', v)} className="justify-center text-center" /></td><td className="px-4 py-3 text-center"><EditableCell value={order.client} onUpdate={(v) => updateEntry('orders', order.id, 'client', v)} className="justify-center text-center" /></td><td className="px-4 py-3 text-center"><EditableCell value={order.vehicle} className="font-mono justify-center text-center" onUpdate={(v) => updateEntry('orders', order.id, 'vehicle', v)} /></td><td className="px-4 py-3 text-center"><EditableCell value={order.truckType} type="text" inputMode="decimal" onUpdate={(v) => updateTruckTypeAndRates(order, v)} className="justify-center text-center" /></td><td className="px-4 py-3 text-center"><input type="checkbox" checked={order.gsChecked || false} onChange={() => toggleGS(order)} className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer" /></td><td className="px-4 py-3 text-center"><EditableCell value={order.loadingBy} onUpdate={(v) => updateEntry('orders', order.id, 'loadingBy', v)} className="justify-center text-center" /></td><td className="px-4 py-3 text-center"><EditableCell value={order.displayLoadRate} type="number" onUpdate={(v) => updateEntry('orders', order.id, 'loadingRate', safeInt(v))} className="justify-center text-center" /></td><td className="px-4 py-3 text-center"><EditableCell value={order.unloadingBy} onUpdate={(v) => updateEntry('orders', order.id, 'unloadingBy', v)} className="justify-center text-center" /></td><td className="px-4 py-3 text-center"><EditableCell value={order.displayUnloadRate} type="number" onUpdate={(v) => updateEntry('orders', order.id, 'unloadingRate', safeInt(v))} className="justify-center text-center" /></td><td className="px-4 py-3 text-center"><EditableCell value={order.remarks} onUpdate={(v) => updateEntry('orders', order.id, 'remarks', v)} className="justify-center text-center" /></td></tr>))}</tbody></table></div></div>
  </div>
);

export const DetailedSalesReportView = ({ getDetailedSalesData, updateEntry, openPreview, updateTruckTypeAndRates, toggleGS, safeInt }) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200"><div><h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-green-600" /> Detailed Sales Report</h2><p className="text-xs text-slate-400">Comprehensive log with billing details</p></div></div>
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm text-center whitespace-nowrap"><thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs"><tr><th className="px-4 py-3 text-center">Date</th><th className="px-4 py-3 text-center">Invoice ID</th><th className="px-4 py-3 text-center">Inv. File</th><th className="px-4 py-3 text-center">Client</th><th className="px-4 py-3 text-center">Site</th><th className="px-4 py-3 text-center">CBM</th><th className="px-4 py-3 text-center">BJM</th><th className="px-4 py-3 text-center">BJM Rate</th><th className="px-4 py-3 text-center">Bill Amt</th><th className="px-4 py-3 text-center">Vehicle</th><th className="px-4 py-3 text-center">Type</th><th className="px-4 py-3 text-center">Transporter</th><th className="px-4 py-3 text-center">Net Wt</th><th className="px-4 py-3 text-center">Loading</th><th className="px-4 py-3 text-center">L. Rate</th><th className="px-4 py-3 text-center">Unloading</th><th className="px-4 py-3 text-center">U. Rate</th><th className="px-4 py-3 text-center">GS</th><th className="px-4 py-3 text-center">Ref</th></tr></thead><tbody className="divide-y divide-slate-100">{getDetailedSalesData().map((order, idx) => (<tr key={order.id} className="hover:bg-slate-50 transition-colors"><td className="px-4 py-3 text-center"><EditableCell value={order.orderDate} type="date" onUpdate={(v) => updateEntry('orders', order.id, 'orderDate', v)} tableId="sales-report" rowIndex={idx} colIndex={0} className="justify-center text-center" /></td><td className="px-4 py-3 text-center"><EditableCell value={order.invoiceId || order.invoiceNumber || ''} onUpdate={(v) => updateEntry('orders', order.id, 'invoiceId', v)} tableId="sales-report" rowIndex={idx} colIndex={1} className="justify-center text-center" /></td><td className="px-4 py-3 text-center">{order.invoice ? (<button onClick={() => openPreview('invoice', order.invoice, order.id, false, order.invoiceUrl)} className="text-indigo-600 hover:underline text-xs">View</button>) : <span className="text-slate-300">-</span>}</td><td className="px-4 py-3 text-center"><EditableCell value={order.client} onUpdate={(v) => updateEntry('orders', order.id, 'client', v)} tableId="sales-report" rowIndex={idx} colIndex={2} className="justify-center text-center" /></td><td className="px-4 py-3 text-center"><EditableCell value={order.location} onUpdate={(v) => updateEntry('orders', order.id, 'location', v)} tableId="sales-report" rowIndex={idx} colIndex={3} className="justify-center text-center" /></td><td className="px-4 py-3 text-center"><EditableCell value={order.cbm} type="text" inputMode="decimal" className="text-center font-mono justify-center" onUpdate={(v) => updateEntry('orders', order.id, 'cbm', v)} tableId="sales-report" rowIndex={idx} colIndex={4} /></td><td className="px-4 py-3 text-center"><EditableCell value={order.bjm} type="text" inputMode="decimal" className="text-center font-mono justify-center" onUpdate={(v) => updateEntry('orders', order.id, 'bjm', v)} tableId="sales-report" rowIndex={idx} colIndex={5} /></td><td className="px-4 py-3 text-center"><EditableCell value={order.bjmRate} type="text" inputMode="decimal" className="text-center font-mono justify-center" onUpdate={(v) => updateEntry('orders', order.id, 'bjmRate', v)} tableId="sales-report" rowIndex={idx} colIndex={6} /></td><td className="px-4 py-3 text-center font-bold text-slate-800">₹ {order.totalBill}</td><td className="px-4 py-3 text-center"><EditableCell value={order.vehicle} className="font-mono justify-center text-center" onUpdate={(v) => updateEntry('orders', order.id, 'vehicle', v)} tableId="sales-report" rowIndex={idx} colIndex={7} /></td><td className="px-4 py-3 text-center"><EditableCell value={order.truckType} type="text" inputMode="decimal" onUpdate={(v) => updateTruckTypeAndRates(order, v)} tableId="sales-report" rowIndex={idx} colIndex={8} className="justify-center text-center" /></td><td className="px-4 py-3 text-center"><EditableCell value={order.transporter} onUpdate={(v) => updateEntry('orders', order.id, 'transporter', v)} tableId="sales-report" rowIndex={idx} colIndex={9} className="justify-center text-center" /></td><td className="px-4 py-3 text-center"><EditableCell value={order.netWt} type="text" inputMode="decimal" className="text-center font-mono justify-center" onUpdate={(v) => updateEntry('orders', order.id, 'netWt', v)} tableId="sales-report" rowIndex={idx} colIndex={10} /></td><td className="px-4 py-3 text-center"><EditableCell value={order.loadingBy} onUpdate={(v) => updateEntry('orders', order.id, 'loadingBy', v)} tableId="sales-report" rowIndex={idx} colIndex={11} className="justify-center text-center" /></td><td className="px-4 py-3 text-center"><EditableCell value={order.displayLoadRate} type="text" inputMode="decimal" className="text-center justify-center" onUpdate={(v) => updateEntry('orders', order.id, 'loadingRate', safeInt(v))} tableId="sales-report" rowIndex={idx} colIndex={12} /></td><td className="px-4 py-3 text-center"><EditableCell value={order.unloadingBy} onUpdate={(v) => updateEntry('orders', order.id, 'unloadingBy', v)} tableId="sales-report" rowIndex={idx} colIndex={13} className="justify-center text-center" /></td><td className="px-4 py-3 text-center"><EditableCell value={order.displayUnloadRate} type="text" inputMode="decimal" className="text-center justify-center" onUpdate={(v) => updateEntry('orders', order.id, 'unloadingRate', safeInt(v))} tableId="sales-report" rowIndex={idx} colIndex={14} /></td><td className="px-4 py-3 text-center"><input type="checkbox" checked={order.gsChecked || false} onChange={() => toggleGS(order)} className="w-4 h-4 text-green-600 rounded border-slate-300 focus:ring-green-500 cursor-pointer" /></td><td className="px-4 py-3 text-center"><EditableCell value={order.reference} onUpdate={(v) => updateEntry('orders', order.id, 'reference', v)} tableId="sales-report" rowIndex={idx} colIndex={15} className="justify-center text-center" /></td></tr>))}</tbody></table></div></div>
  </div>
);

export const DieselRegisterView = ({
  getDieselRegisterData,
  updateEntry,
  handleManualDieselSubmit,
  manualDieselForm,
  setManualDieselForm,
  handleDieselIntakeSubmit,
  dieselIntakeForm,
  setDieselIntakeForm,
  dieselViewDate,
  setDieselViewDate,
  getTodayString,
  setView,
  onDeleteEntry,
}) => {
  const entries = getDieselRegisterData(dieselViewDate);

  const handleDateChange = (offset) => {
    const current = new Date(`${dieselViewDate || getTodayString()}T12:00:00Z`);
    if (Number.isNaN(current.getTime())) return;
    current.setUTCDate(current.getUTCDate() + offset);
    setDieselViewDate(current.toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
        <div className="text-center lg:text-left">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Fuel className="w-5 h-5 text-orange-600" /> Diesel Usage Register</h2>
          <p className="text-xs text-slate-400">Daily balance, inflow, and vehicle usage log</p>
        </div>
        <div className="flex items-center justify-center gap-2">
          <button type="button" onClick={() => handleDateChange(-1)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><ChevronLeft className="w-4 h-4" /></button>
          <input type="date" value={dieselViewDate} onChange={(e) => setDieselViewDate(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500" />
          <button type="button" onClick={() => handleDateChange(1)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <div className="flex justify-center lg:justify-end">
          <button
            type="button"
            onClick={() => setView('diesel-monthly-report')}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-orange-700"
          >
            <Calendar className="w-4 h-4" />
            Monthly Report
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[1280px] w-full table-fixed text-[11px] md:text-sm text-center">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wide">
                <tr>
                  <th className="px-3 py-3 w-[9%] text-center">Date</th>
                  <th className="px-3 py-3 w-[12%] text-center">Vehicle Number</th>
                  <th className="px-3 py-3 w-[8%] text-center">Opening</th>
                  <th className="px-3 py-3 w-[8%] text-center">Type</th>
                  <th className="px-3 py-3 w-[12%] text-center">Client / Machine</th>
                  <th className="px-3 py-3 w-[11%] text-center">Loc / Site</th>
                  <th className="px-3 py-3 w-[11%] text-center">Operator / Issued To</th>
                  <th className="px-3 py-3 w-[11%] text-center">Purpose</th>
                  <th className="px-3 py-3 w-[8%] text-center">KM / Hrs</th>
                  <th className="px-3 py-3 w-[8%] text-center">HSD (L)</th>
                  <th className="px-3 py-3 w-[8%] text-center">Closing</th>
                  <th className="px-3 py-3 w-[5%] text-center">Del</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((entry, index) => {
                  const isIntake = String(entry.flowType || '').toLowerCase() === 'inflow';
                  const typeLabel = isIntake ? 'Inflow' : 'Usage';

                  if (entry.isPlaceholder) {
                    return (
                      <tr key={entry.id} className="bg-slate-50/70">
                        <td className="px-4 py-3 font-medium text-center text-slate-800 whitespace-nowrap">{formatDateDisplay(entry.date)}</td>
                        <td className="px-3 py-3 font-mono text-center text-slate-600">-</td>
                        <td className="px-3 py-3 text-center font-semibold text-slate-700">{entry.opening.toFixed(2)}</td>
                        <td className="px-3 py-3 text-center"><span className="inline-flex rounded-full bg-slate-200 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-700">Opening</span></td>
                        <td className="px-3 py-3 text-center text-slate-600">Opening Balance</td>
                        <td className="px-3 py-3 text-center text-slate-500">-</td>
                        <td className="px-3 py-3 text-center text-slate-500">-</td>
                        <td className="px-3 py-3 text-center text-slate-500">Carry Forward</td>
                        <td className="px-3 py-3 text-center text-slate-500">-</td>
                        <td className="px-3 py-3 text-center font-bold text-slate-700">0.00</td>
                        <td className="px-3 py-3 text-center font-semibold text-slate-700">{entry.closing.toFixed(2)}</td>
                        <td className="px-3 py-3 text-center text-slate-300">-</td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-center text-slate-800 whitespace-nowrap"><EditableCell value={entry.date} type="date" displayFormatter={formatDateDisplay} className="justify-center text-center" onUpdate={(v) => updateEntry(entry.collection, entry.sourceId, 'date', v)} tableId="diesel-register" rowIndex={index} colIndex={0} /></td>
                      <td className="px-3 py-3 font-mono text-center text-slate-700"><EditableCell value={entry.vehicle} className="justify-center text-center" onUpdate={(v) => updateEntry(entry.collection, entry.sourceId, 'vehicle', v)} tableId="diesel-register" rowIndex={index} colIndex={1} /></td>
                      <td className="px-3 py-3 text-center font-semibold text-slate-700">{entry.opening.toFixed(2)}</td>
                      <td className="px-3 py-3 text-center"><span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${isIntake ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>{typeLabel}</span></td>
                      <td className="px-3 py-3 text-center text-slate-700"><EditableCell value={entry.name} className="justify-center text-center" onUpdate={(v) => updateEntry(entry.collection, entry.sourceId, 'name', v)} tableId="diesel-register" rowIndex={index} colIndex={2} /></td>
                      <td className="px-3 py-3 text-center text-slate-500"><EditableCell value={entry.location} className="justify-center text-center" onUpdate={(v) => updateEntry(entry.collection, entry.sourceId, 'location', v)} tableId="diesel-register" rowIndex={index} colIndex={3} /></td>
                      <td className="px-3 py-3 text-center text-slate-600"><EditableCell value={entry.driver} className="justify-center text-center" onUpdate={(v) => updateEntry(entry.collection, entry.sourceId, 'driver', v)} tableId="diesel-register" rowIndex={index} colIndex={4} /></td>
                      <td className="px-3 py-3 text-center text-slate-600"><EditableCell value={entry.purpose || ''} className="justify-center text-center" onUpdate={(v) => updateEntry(entry.collection, entry.sourceId, 'purpose', v)} tableId="diesel-register" rowIndex={index} colIndex={5} /></td>
                      <td className="px-3 py-3 text-center text-slate-600"><EditableCell value={entry.km} className="justify-center text-center" onUpdate={(v) => updateEntry(entry.collection, entry.sourceId, 'km', v)} tableId="diesel-register" rowIndex={index} colIndex={6} /></td>
                      <td className="px-3 py-3 text-center font-bold text-slate-800"><EditableCell value={entry.hsd} className="justify-center text-center" onUpdate={(v) => updateEntry(entry.collection, entry.sourceId, 'hsd', v)} tableId="diesel-register" rowIndex={index} colIndex={7} /></td>
                      <td className="px-3 py-3 text-center font-semibold text-slate-700">{entry.closing.toFixed(2)}</td>
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => onDeleteEntry && onDeleteEntry(entry)}
                          className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          aria-label={`Delete diesel row ${entry.vehicle || entry.name || ''}`.trim()}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <Card className="p-6 border border-orange-100 bg-gradient-to-br from-white via-orange-50 to-white [&_label]:text-center">
          <div className="mb-4 text-center">
            <h3 className="font-bold text-slate-800 flex items-center justify-center gap-2"><Plus className="w-4 h-4 text-orange-600" /> In-Plant Usage</h3>
            <p className="text-xs text-slate-500">Vehicle-based usage entries for the selected day</p>
          </div>
          <form onSubmit={handleManualDieselSubmit} className="mx-auto w-full max-w-6xl space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              <InputGroup label="Vehicle Number">
                <input type="text" required className="w-full rounded-lg border border-slate-300 p-2.5 text-center outline-none focus:ring-2 focus:ring-orange-500" value={manualDieselForm.vehicle} onChange={(e) => setManualDieselForm({ ...manualDieselForm, vehicle: e.target.value })} placeholder="e.g. MH12AB1234" />
              </InputGroup>
              <InputGroup label="Site / Location">
                <input type="text" required className="w-full rounded-lg border border-slate-300 p-2.5 text-center outline-none focus:ring-2 focus:ring-orange-500" value={manualDieselForm.location} onChange={(e) => setManualDieselForm({ ...manualDieselForm, location: e.target.value })} placeholder="e.g. Plant A" />
              </InputGroup>
              <InputGroup label="Purpose">
                <input type="text" required className="w-full rounded-lg border border-slate-300 p-2.5 text-center outline-none focus:ring-2 focus:ring-orange-500" value={manualDieselForm.purpose || ''} onChange={(e) => setManualDieselForm({ ...manualDieselForm, purpose: e.target.value })} placeholder="Required for usage" />
              </InputGroup>
              <InputGroup label="Operator / Issued To">
                <input type="text" required className="w-full rounded-lg border border-slate-300 p-2.5 text-center outline-none focus:ring-2 focus:ring-orange-500" value={manualDieselForm.driver} onChange={(e) => setManualDieselForm({ ...manualDieselForm, driver: e.target.value })} placeholder="Name" />
              </InputGroup>
                            <InputGroup label="HSD (Liters)">
                <input type="text" required className="w-full rounded-lg border border-slate-300 p-2.5 text-center outline-none focus:ring-2 focus:ring-orange-500" value={manualDieselForm.hsd} onChange={(e) => setManualDieselForm({ ...manualDieselForm, hsd: e.target.value })} placeholder="0.00" />
              </InputGroup>
              <InputGroup label="KM / Hrs">
                <input type="text" className="w-full rounded-lg border border-slate-300 p-2.5 text-center outline-none focus:ring-2 focus:ring-orange-500" value={manualDieselForm.km || ''} onChange={(e) => setManualDieselForm({ ...manualDieselForm, km: e.target.value })} placeholder="Optional" />
              </InputGroup>
            </div>
            <button type="submit" className="mt-1 w-full rounded-lg bg-orange-600 py-2.5 text-center font-bold text-white shadow-sm hover:bg-orange-700">Log Usage</button>
          </form>

          <div className="mt-6 border-t border-orange-100 pt-6">
            <div className="mb-4 text-center">
              <h4 className="text-base font-bold text-emerald-800">Diesel Intake</h4>
            </div>
            <form onSubmit={handleDieselIntakeSubmit} className="mx-auto w-full max-w-4xl">
              <div className="space-y-3">
                <input
                  type="text"
                  required
                  inputMode="decimal"
                  aria-label="Liters"
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-center outline-none focus:ring-2 focus:ring-emerald-500"
                  value={dieselIntakeForm.liters}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    if (nextValue === '' || /^[0-9]*\.?[0-9]*$/.test(nextValue)) {
                      setDieselIntakeForm({ ...dieselIntakeForm, liters: nextValue });
                    }
                  }}
                  placeholder="0.00"
                />
                <button type="submit" className="w-full rounded-lg bg-emerald-600 px-6 py-2.5 text-center font-bold text-white shadow-sm hover:bg-emerald-700">Add Intake</button>
              </div>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
};

const formatDieselMonthLabel = (month) => {
  const normalized = String(month || '').trim();
  if (!/^\d{4}-\d{2}$/.test(normalized)) return normalized;

  const [year, monthPart] = normalized.split('-');
  const monthIndex = Number(monthPart) - 1;
  const date = new Date(Date.UTC(Number(year), monthIndex, 1, 12, 0, 0));
  if (Number.isNaN(date.getTime())) return normalized;

  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(date);
};

export const MonthlyDieselReportView = ({
  reportMonth,
  setReportMonth,
  loadMonthlyDieselReport,
  loadMonthlyDieselVehicleTrips,
  setView,
}) => {
  const [report, setReport] = React.useState({ month: reportMonth, totals: { kilometers: 0, dieselUsed: 0, tripCount: 0, vehicleCount: 0 }, vehicles: [] });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [expandedVehicle, setExpandedVehicle] = React.useState('');
  const [tripDetails, setTripDetails] = React.useState({});
  const [tripLoading, setTripLoading] = React.useState({});

  React.useEffect(() => {
    let active = true;

    const loadReport = async () => {
      setLoading(true);
      setError('');
      setExpandedVehicle('');
      setTripDetails({});
      setTripLoading({});

      try {
        const nextReport = await loadMonthlyDieselReport(reportMonth);
        if (!active) return;
        setReport(nextReport || { month: reportMonth, totals: { kilometers: 0, dieselUsed: 0, tripCount: 0, vehicleCount: 0 }, vehicles: [] });
      } catch (err) {
        if (!active) return;
        setError(err?.message || 'Failed to load monthly diesel report.');
        setReport({ month: reportMonth, totals: { kilometers: 0, dieselUsed: 0, tripCount: 0, vehicleCount: 0 }, vehicles: [] });
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadReport();

    return () => {
      active = false;
    };
  }, [loadMonthlyDieselReport, reportMonth]);

  const vehicles = Array.isArray(report?.vehicles) ? report.vehicles : [];

  const toggleVehicle = async (vehicleNumber) => {
    const normalizedVehicle = String(vehicleNumber || '').trim().toUpperCase();
    if (!normalizedVehicle) return;

    if (expandedVehicle === normalizedVehicle) {
      setExpandedVehicle('');
      return;
    }

    setExpandedVehicle(normalizedVehicle);

    if (tripDetails[normalizedVehicle]) return;

    setTripLoading((prev) => ({ ...prev, [normalizedVehicle]: true }));
    try {
      const detailReport = await loadMonthlyDieselVehicleTrips(reportMonth, normalizedVehicle);
      setTripDetails((prev) => ({ ...prev, [normalizedVehicle]: Array.isArray(detailReport?.trips) ? detailReport.trips : [] }));
    } catch (err) {
      setTripDetails((prev) => ({ ...prev, [normalizedVehicle]: [] }));
      setError(err?.message || 'Failed to load vehicle trip history.');
    } finally {
      setTripLoading((prev) => ({ ...prev, [normalizedVehicle]: false }));
    }
  };

  const monthValue = String(reportMonth || '').slice(0, 7);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Diesel Usage</div>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Monthly Vehicle Summary</h2>
            <p className="text-sm text-slate-500">Expanded vehicle history shown as a compact table for faster scanning.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setView('diesel-register')}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <ChevronLeft className="mr-1.5 w-4 h-4" />
              Back to Register
            </button>
            <InputGroup label="Report Month">
              <input
                type="month"
                value={monthValue}
                onChange={(e) => setReportMonth(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center outline-none focus:ring-2 focus:ring-orange-500 sm:w-44"
              />
            </InputGroup>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4 border border-slate-200 bg-white">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Vehicles</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{report?.totals?.vehicleCount || 0}</div>
        </Card>
        <Card className="p-4 border border-slate-200 bg-white">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Trips</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{report?.totals?.tripCount || 0}</div>
        </Card>
        <Card className="p-4 border border-slate-200 bg-white">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Kilometers</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{formatDieselMetric(report?.totals?.kilometers)}</div>
        </Card>
        <Card className="p-4 border border-slate-200 bg-white">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Diesel Used</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{formatDieselMetric(report?.totals?.dieselUsed)}</div>
        </Card>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading monthly report...</div>
        ) : vehicles.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No diesel usage entries were found for {formatDieselMonthLabel(report?.month || reportMonth)}.</div>
        ) : (
          <table className="w-full table-fixed text-center text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-12 px-3 py-3 text-center"></th>
                <th className="px-3 py-3 text-center">Vehicle Number</th>
                <th className="px-3 py-3 text-center">Kilometers</th>
                <th className="px-3 py-3 text-center">Diesel Used</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vehicles.map((vehicle) => {
                const normalizedVehicle = String(vehicle.vehicleNumber || '').trim().toUpperCase();
                const expanded = expandedVehicle === normalizedVehicle;
                const details = tripDetails[normalizedVehicle] || [];
                const loadingDetails = tripLoading[normalizedVehicle];

                return (
                  <React.Fragment key={normalizedVehicle}>
                    <tr className={`transition-colors ${expanded ? 'bg-orange-50/40' : 'hover:bg-slate-50'}`}>
                      <td className="px-3 py-3 align-top">
                        <button
                          type="button"
                          onClick={() => toggleVehicle(normalizedVehicle)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600"
                          aria-expanded={expanded}
                          aria-label={expanded ? `Collapse ${normalizedVehicle}` : `Expand ${normalizedVehicle}`}
                        >
                          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
                        </button>
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-900">{normalizedVehicle}</td>
                      <td className="px-3 py-3 text-center font-semibold text-slate-800">{formatDieselMetric(vehicle.kilometers)}</td>
                      <td className="px-3 py-3 text-center font-semibold text-slate-800">{formatDieselMetric(vehicle.dieselUsed)}</td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="px-3 pb-0 pt-0">
                        <div className={`overflow-hidden transition-all duration-300 ${expanded ? 'max-h-[2000px] opacity-100 pb-4' : 'max-h-0 opacity-0'}`}>
                          <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-4">
                            {loadingDetails ? (
                              <div className="text-sm text-slate-500">Loading trip history...</div>
                            ) : details.length === 0 ? (
                              <div className="text-sm text-slate-500">No trip details found for this vehicle in {formatDieselMonthLabel(report?.month || reportMonth)}.</div>
                            ) : (
                              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                <table className="min-w-[1100px] w-full table-fixed text-sm text-center">
                                  <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                    <tr>
                                      <th className="px-3 py-3 w-[11%]">Trip Date</th>
                                      <th className="px-3 py-3 w-[11%]">Kilometers</th>
                                      <th className="px-3 py-3 w-[11%]">Diesel Used</th>
                                      <th className="px-3 py-3 w-[21%]">Location</th>
                                      <th className="px-3 py-3 w-[18%]">Operator</th>
                                      <th className="px-3 py-3 w-[20%]">Purpose</th>
                                      <th className="px-3 py-3 w-[8%]">Invoice</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {details.map((trip) => (
                                      <tr key={trip.id || `${trip.date}-${trip.createdAt}-${trip.km}`} className="hover:bg-slate-50">
                                        <td className="px-3 py-3 font-medium text-slate-900 whitespace-nowrap">{formatDateDisplay(trip.date) || '-'}</td>
                                        <td className="px-3 py-3 font-semibold text-slate-900">{formatDieselMetric(trip.km)}</td>
                                        <td className="px-3 py-3 font-semibold text-slate-900">{formatDieselMetric(trip.dieselUsed)}</td>
                                        <td className="px-3 py-3 text-slate-700">{trip.location || '-'}</td>
                                        <td className="px-3 py-3 text-slate-700">{trip.driver || '-'}</td>
                                        <td className="px-3 py-3 text-slate-700">{trip.purpose || '-'}</td>
                                        <td className="px-3 py-3 text-slate-700 whitespace-nowrap">{trip.invoiceNumber || '-'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const CLIENT_SITE_OPTIONS = {
  'ABC Constructions': {
    gstin: '27ABCDE1234F1Z5',
    sites: [
      { name: 'Nashik Plant', aacRate: 4300, bjmRate: 9 },
      { name: 'Igatpuri Site', aacRate: 4380, bjmRate: 10 },
    ],
  },
  'Skyline Infra': {
    gstin: '27SKYLI5588A1Z1',
    sites: [
      { name: 'Pune East', aacRate: 4450, bjmRate: 11 },
      { name: 'Pimpri Yard', aacRate: 4525, bjmRate: 12 },
    ],
  },
  'Shree Developers': {
    gstin: '27SHREE4422M1Z2',
    sites: [
      { name: 'Aurangabad Main', aacRate: 4250, bjmRate: 8 },
      { name: 'CIDCO Extension', aacRate: 4325, bjmRate: 9 },
    ],
  },
};

const VEHICLE_OPTIONS = {
  MH12AB1234: { vehicleType: '12 W', transporter: 'ABC Logistics' },
  MH15CD5678: { vehicleType: '10 W', transporter: 'Shree Transport' },
  GJ05EF9012: { vehicleType: '14 W', transporter: 'Swift Carriers' },
};

const TRANSPORTER_OPTIONS = ['ABC Logistics', 'Shree Transport', 'Swift Carriers', 'Local Fleet'];

const formatNumberText = (value, decimals = 2) => {
  if (!Number.isFinite(value)) return '';
  return value.toFixed(decimals).replace(/\.?0+$/, '');
};

export const NewOrderView = ({
  setView,
  editingOrderId,
  viewDate,
  formatDateDisplay,
  handleSubmitOrder,
  formData,
  setFormData,
  clientProfiles = [],
  clientSearchLoading = false,
  requestClientProfiles,
  SIZES,
}) => {
  const staticProfiles = React.useMemo(() => Object.entries(CLIENT_SITE_OPTIONS).map(([clientName, config]) => ({
    clientName,
    gstin: String(config?.gstin || '').trim(),
    sites: (config?.sites || []).map((site) => ({
      siteName: site.name,
      aacRate: Number(site.aacRate),
      bjmRate: Number(site.bjmRate),
      lastUsedAt: '',
    })),
  })), []);

  const mergedClientProfiles = React.useMemo(() => {
    const byClient = new Map();
    const sourceProfiles = [...staticProfiles, ...(Array.isArray(clientProfiles) ? clientProfiles : [])];

    sourceProfiles.forEach((profile) => {
      const clientName = String(profile?.clientName || profile?.client || '').trim();
      if (!clientName) return;

      const clientKey = clientName.toLowerCase();
      if (!byClient.has(clientKey)) {
        byClient.set(clientKey, {
          clientName,
          gstin: String(profile?.gstin || '').trim(),
          sites: new Map(),
        });
      }

      const existingProfile = byClient.get(clientKey);
      if (!existingProfile.gstin && profile?.gstin) {
        existingProfile.gstin = String(profile.gstin).trim();
      }

      (Array.isArray(profile?.sites) ? profile.sites : []).forEach((site) => {
        const siteName = String(site?.siteName || site?.name || '').trim();
        if (!siteName) return;
        const siteKey = siteName.toLowerCase();
        if (existingProfile.sites.has(siteKey)) return;

        const parsedAacRate = Number(site?.aacRate);
        const parsedBjmRate = Number(site?.bjmRate);

        existingProfile.sites.set(siteKey, {
          siteName,
          aacRate: Number.isFinite(parsedAacRate) ? parsedAacRate : null,
          bjmRate: Number.isFinite(parsedBjmRate) ? parsedBjmRate : null,
        });
      });
    });

    return Array.from(byClient.values())
      .map((profile) => ({
        clientName: profile.clientName,
        gstin: profile.gstin,
        sites: Array.from(profile.sites.values()).sort((a, b) => a.siteName.localeCompare(b.siteName)),
      }))
      .sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [staticProfiles, clientProfiles]);

  const selectedClientProfile = React.useMemo(() => mergedClientProfiles.find(
    (profile) => profile.clientName.toLowerCase() === String(formData.client || '').trim().toLowerCase(),
  ) || null, [mergedClientProfiles, formData.client]);

  const locationOptions = selectedClientProfile ? selectedClientProfile.sites.map((site) => site.siteName) : [];
  const clientOptions = React.useMemo(() => {
    const query = String(formData.client || '').trim().toLowerCase();
    if (!query) return mergedClientProfiles.map((profile) => profile.clientName).slice(0, 40);

    return mergedClientProfiles
      .filter((profile) => profile.clientName.toLowerCase().includes(query))
      .map((profile) => profile.clientName)
      .slice(0, 40);
  }, [mergedClientProfiles, formData.client]);

  React.useEffect(() => {
    if (typeof requestClientProfiles !== 'function') return undefined;

    const query = String(formData.client || '').trim();
    if (!query) {
      requestClientProfiles('');
      return undefined;
    }

    const timer = setTimeout(() => {
      requestClientProfiles(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [formData.client, requestClientProfiles]);
  const vehicleOptions = Object.keys(VEHICLE_OPTIONS);
  const additionalProducts = formData.additionalProducts || [];
  const quantityUnit = formData.quantityUnit || 'CBM';
  const quantityValue = formData.quantityValue ?? '';
  const primaryPerPiece = getVolumePerPieceFromSize(formData.size || SIZES[3]);
  const quantityNumber = quantityValue === '' ? 0 : Number(quantityValue);
  const primaryCbm = quantityValue === '' ? 0 : (quantityUnit === 'PCS' ? convertPiecesToCbm(quantityNumber, formData.size || SIZES[3]) : quantityNumber);
  const canPublish = Boolean(String(formData.vehicle || '').trim() && String(formData.vehicleType || '').trim() && String(formData.transporter || '').trim());

  const handleClientChange = (e) => {
    const nextClient = e.target.value;
    setFormData((prev) => {
      const exactClient = mergedClientProfiles.find(
        (profile) => profile.clientName.toLowerCase() === nextClient.trim().toLowerCase(),
      );

      const validLocation = exactClient?.sites.some(
        (site) => site.siteName.toLowerCase() === String(prev.location || '').trim().toLowerCase(),
      )
        ? prev.location
        : '';
      const matchedSite = exactClient?.sites.find(
        (site) => site.siteName.toLowerCase() === validLocation.trim().toLowerCase(),
      );

      return {
        ...prev,
        client: nextClient,
        location: validLocation,
        gstin: prev.gstin || exactClient?.gstin || '',
        rate: prev.aacRateManualOverride ? prev.rate : (matchedSite && matchedSite.aacRate !== null ? String(matchedSite.aacRate) : ''),
        bjmRate: prev.bjmRateManualOverride ? prev.bjmRate : (matchedSite && matchedSite.bjmRate !== null ? String(matchedSite.bjmRate) : ''),
      };
    });
  };

  const handleLocationChange = (e) => {
    const nextLocation = e.target.value;
    setFormData((prev) => {
      const matchedSite = selectedClientProfile?.sites.find(
        (site) => site.siteName.toLowerCase() === nextLocation.trim().toLowerCase(),
      );

      return {
        ...prev,
        location: nextLocation,
        rate: prev.aacRateManualOverride ? prev.rate : (matchedSite && matchedSite.aacRate !== null ? String(matchedSite.aacRate) : ''),
        bjmRate: prev.bjmRateManualOverride ? prev.bjmRate : (matchedSite && matchedSite.bjmRate !== null ? String(matchedSite.bjmRate) : ''),
      };
    });
  };

  const handleVehicleChange = (e) => {
    const nextVehicle = e.target.value.toUpperCase();
    setFormData((prev) => {
      const matchedVehicle = VEHICLE_OPTIONS[nextVehicle];
      return {
        ...prev,
        vehicle: nextVehicle,
        vehicleType: matchedVehicle ? formatTruckTypeShort(matchedVehicle.vehicleType) : prev.vehicleType,
        transporter: matchedVehicle ? matchedVehicle.transporter : prev.transporter,
      };
    });
  };

  const handlePrimarySizeChange = (e) => {
    const nextSize = e.target.value;
    setFormData((prev) => {
      if ((prev.quantityUnit || 'CBM') !== 'PCS' || String(prev.quantityValue ?? '').trim() === '') {
        return { ...prev, size: nextSize };
      }

      const nextCbm = convertPiecesToCbm(Number(prev.quantityValue), nextSize);
      return { ...prev, size: nextSize, cbm: Number(nextCbm.toFixed(3)) };
    });
  };

  const handlePrimaryQuantityChange = (e) => {
    const rawValue = e.target.value;
    setFormData((prev) => {
      const currentUnit = prev.quantityUnit || 'CBM';
      const perPiece = getVolumePerPieceFromSize(prev.size || SIZES[3]);
      const numericValue = rawValue === '' ? null : Number(rawValue);
      if (numericValue === null || Number.isNaN(numericValue)) {
        return { ...prev, quantityValue: rawValue, cbm: '' };
      }

      const nextCbm = currentUnit === 'PCS' ? numericValue * perPiece : numericValue;
      return {
        ...prev,
        quantityValue: rawValue,
        cbm: Number(nextCbm.toFixed(3)),
      };
    });
  };

  const handlePrimaryUnitChange = (e) => {
    const nextUnit = e.target.value;
    setFormData((prev) => {
      if (String(prev.quantityValue ?? '').trim() === '') return { ...prev, quantityUnit: nextUnit };

      const prevUnit = prev.quantityUnit || 'CBM';
      const perPiece = getVolumePerPieceFromSize(prev.size || SIZES[3]);
      const previousQuantity = Number(prev.quantityValue);
      if (Number.isNaN(previousQuantity)) return { ...prev, quantityUnit: nextUnit };

      const physicalCbm = prevUnit === 'PCS' ? previousQuantity * perPiece : previousQuantity;
      const nextQuantity = nextUnit === 'PCS' ? (perPiece > 0 ? physicalCbm / perPiece : 0) : physicalCbm;

      return {
        ...prev,
        quantityUnit: nextUnit,
        quantityValue: formatNumberText(nextQuantity, nextUnit === 'PCS' ? 2 : 3),
        cbm: Number(physicalCbm.toFixed(3)),
      };
    });
  };

  const addProductRow = () => {
    setFormData((prev) => ({
      ...prev,
      additionalProducts: [
        ...(prev.additionalProducts || []),
        {
          size: prev.size || SIZES[3],
          quantity: '',
          quantityUnit: 'CBM',
          rate: prev.rate || '',
        },
      ],
    }));
  };

  const updateProductRow = (index, patch) => {
    setFormData((prev) => ({
      ...prev,
      additionalProducts: (prev.additionalProducts || []).map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }));
  };

  const removeProductRow = (index) => {
    setFormData((prev) => ({
      ...prev,
      additionalProducts: (prev.additionalProducts || []).filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center space-x-2 mb-6 text-sm text-slate-500 cursor-pointer hover:text-blue-600" onClick={() => setView('daily-log')}>
        <ArrowRight className="rotate-180 w-4 h-4" /> <span>Back to Daily Log</span>
      </div>

      <Card className="p-6 md:p-8">
        <h2 className="text-xl font-bold text-slate-800 mb-2">{editingOrderId ? 'Update Order' : 'Create Loading Plan'}</h2>
        <div className="mb-6 p-3 bg-blue-50 text-blue-700 text-sm rounded-lg flex items-center"><Calendar className="w-4 h-4 mr-2" />Order for: <span className="font-bold ml-1">{formatDateDisplay(viewDate)}</span></div>

        <form onSubmit={handleSubmitOrder} className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Invoice</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InputGroup label="Invoice ID (Optional)">
                <input type="text" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.invoiceId || ''} onChange={(e) => setFormData({ ...formData, invoiceId: e.target.value })} placeholder="Can be left empty until dispatch" />
              </InputGroup>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Client Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InputGroup label="Client Name">
                <input type="text" list="client-name-options" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.client || ''} onChange={handleClientChange} placeholder="Select or type client" />
                <datalist id="client-name-options">{clientOptions.map((client) => <option key={client} value={client} />)}</datalist>
                {clientSearchLoading && <p className="text-[11px] text-slate-500 mt-1">Searching existing clients...</p>}
              </InputGroup>

              <InputGroup label="Location (Client Site)">
                <input type="text" list="client-site-options" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.location || ''} onChange={handleLocationChange} placeholder="Select or type site" />
                <datalist id="client-site-options">{locationOptions.map((site) => <option key={site} value={site} />)}</datalist>
              </InputGroup>

              <InputGroup label="GSTIN (Optional)">
                <input type="text" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.gstin || ''} onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })} placeholder="Can be left empty" />
              </InputGroup>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Vehicle Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InputGroup label="Vehicle Number">
                <input required type="text" list="vehicle-number-options" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.vehicle || ''} onChange={handleVehicleChange} placeholder="Required" />
                <datalist id="vehicle-number-options">{vehicleOptions.map((vehicle) => <option key={vehicle} value={vehicle} />)}</datalist>
              </InputGroup>

              <InputGroup label="Vehicle Type">
                <input required type="text" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.vehicleType || ''} onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })} placeholder="Required" />
              </InputGroup>

              <InputGroup label="Transporter">
                <input required type="text" list="transporter-options" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.transporter || ''} onChange={(e) => setFormData({ ...formData, transporter: e.target.value })} placeholder="Required" />
                <datalist id="transporter-options">{TRANSPORTER_OPTIONS.map((transporter) => <option key={transporter} value={transporter} />)}</datalist>
              </InputGroup>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Products</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InputGroup label="AAC Size">
                <select className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={formData.size || SIZES[3]} onChange={handlePrimarySizeChange}>
                  {SIZES.map((sizeOption) => <option key={sizeOption} value={sizeOption}>{sizeOption}</option>)}
                </select>
              </InputGroup>

              <InputGroup label="Quantity">
                <div className="flex gap-2">
                  <input type="text" inputMode="decimal" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.quantityValue || ''} onChange={handlePrimaryQuantityChange} placeholder="Enter quantity" />
                  <select className="w-24 p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={quantityUnit} onChange={handlePrimaryUnitChange}>
                    <option value="CBM">CBM</option>
                    <option value="PCS">PCS</option>
                  </select>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">{quantityValue === '' ? 'Select unit and enter quantity' : (quantityUnit === 'CBM' ? `~ ${formatNumberText(primaryPerPiece > 0 ? primaryCbm / primaryPerPiece : 0, 2)} PCS` : `~ ${formatNumberText(primaryCbm, 3)} CBM`)}</p>
              </InputGroup>

              <InputGroup label="Rate (AAC Block)">
                <input id="aac_rate" type="text" inputMode="decimal" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.rate || ''} onChange={(e) => setFormData({ ...formData, rate: e.target.value, aacRateManualOverride: true })} placeholder="Auto-filled by client + site" />
                {formData.aacRateManualOverride && <p className="text-[11px] text-amber-600 mt-1">Manual override enabled. Suggest updating master rates later.</p>}
              </InputGroup>
            </div>

            <div className="flex justify-start">
              <button type="button" onClick={addProductRow} className="px-4 py-2.5 border border-dashed border-blue-300 text-blue-700 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors text-sm font-semibold">+ Add Size</button>
            </div>

            {additionalProducts.length > 0 && (
              <div className="space-y-3 pt-1">
                {additionalProducts.map((product, index) => {
                  const productUnit = product.quantityUnit || 'CBM';
                  const productPerPiece = getVolumePerPieceFromSize(product.size || SIZES[3]);
                  const productQuantity = Number(product.quantity || 0);
                  const productCbm = product.quantity === '' ? 0 : (productUnit === 'PCS' ? productQuantity * productPerPiece : productQuantity);
                  const helperText = product.quantity === ''
                    ? 'Enter quantity'
                    : (productUnit === 'CBM' ? `~ ${formatNumberText(productPerPiece > 0 ? productCbm / productPerPiece : 0, 2)} PCS` : `~ ${formatNumberText(productCbm, 3)} CBM`);

                  return (
                    <div key={`${product.size}-${index}`} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg border border-slate-200 bg-slate-50">
                      <InputGroup label={`Additional AAC Size ${index + 1}`}>
                        <select className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={product.size || SIZES[3]} onChange={(e) => updateProductRow(index, { size: e.target.value })}>
                          {SIZES.map((sizeOption) => <option key={sizeOption} value={sizeOption}>{sizeOption}</option>)}
                        </select>
                      </InputGroup>

                      <InputGroup label="Quantity">
                        <div className="flex gap-2">
                          <input type="text" inputMode="decimal" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={product.quantity || ''} onChange={(e) => updateProductRow(index, { quantity: e.target.value })} />
                          <select className="w-24 p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={productUnit} onChange={(e) => updateProductRow(index, { quantityUnit: e.target.value })}>
                            <option value="CBM">CBM</option>
                            <option value="PCS">PCS</option>
                          </select>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">{helperText}</p>
                      </InputGroup>

                      <InputGroup label="Rate (AAC Block)">
                        <div className="flex gap-2">
                          <input type="text" inputMode="decimal" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={product.rate || ''} onChange={(e) => updateProductRow(index, { rate: e.target.value })} />
                          <button type="button" className="px-3 py-2.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold" onClick={() => removeProductRow(index)}>Remove</button>
                        </div>
                      </InputGroup>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InputGroup label="BJM (Bags)">
                <input type="text" inputMode="decimal" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.bjm || ''} onChange={(e) => setFormData({ ...formData, bjm: e.target.value })} placeholder="Optional" />
              </InputGroup>

              <InputGroup label="Rate (bjm_rate)">
                <input id="bjm_rate" type="text" inputMode="decimal" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.bjmRate || ''} onChange={(e) => setFormData({ ...formData, bjmRate: e.target.value, bjmRateManualOverride: true })} placeholder="Auto-filled by client + site" />
                {formData.bjmRateManualOverride && <p className="text-[11px] text-amber-600 mt-1">Manual override enabled. Suggest updating master rates later.</p>}
              </InputGroup>
              <div></div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">Only Vehicle Number, Vehicle Type, and Transporter are required to publish.</p>
            <button type="submit" disabled={!canPublish} className={`px-6 py-2.5 rounded-lg font-bold shadow-sm transition-colors ${canPublish ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}>{editingOrderId ? 'Update Order' : 'Publish Order'}</button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export const DailyLogView = ({
  filterMode,
  handleDateChange,
  setViewAndFilter,
  viewDate,
  formatDateDisplay,
  getTodayString,
  displayedOrders,
  role,
  handleEditOrder,
  triggerDelete,
  openPreview,
  updateStatus,
  setDispatchModalOrderId,
  setMtcModalOrderId,
  handleFileUpload,
}) => {
  const getAllowedLoadingStatuses = (currentStatus) => {
    const flow = {
      'Awaiting Truck': ['Awaiting Truck', 'Truck at Site'],
      'Truck at Site': ['Truck at Site', 'Loading'],
      Loading: ['Loading', 'Loading Complete'],
      'Loading Complete': ['Loading Complete'],
    };

    return flow[currentStatus] || ['Awaiting Truck'];
  };

  return (
  <div className="space-y-6">
    <div className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-slate-200">
      {filterMode === 'date' ? (<button onClick={() => handleDateChange(-1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"><ChevronLeft className="w-5 h-5" /></button>) : (<div className="w-9"></div>)}
      <div className="flex flex-col items-center">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{filterMode === 'date' ? 'Daily Loading Plan' : 'Filtered View'}</span>
        {filterMode === 'date' && (<><span className="text-lg font-bold text-slate-800 flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-500" />{formatDateDisplay(viewDate)}</span>{viewDate === getTodayString() && <span className="text-[10px] text-blue-600 bg-blue-50 px-2 rounded-full font-bold mt-1">TODAY</span>}</>)}
        {filterMode === 'active' && <span className="text-lg font-bold text-orange-600 flex items-center gap-2 bg-orange-50 px-4 py-1 rounded-full mt-1"><Truck className="w-4 h-4" /> All Active Loads</span>}
        {filterMode === 'approval' && <span className="text-lg font-bold text-green-600 flex items-center gap-2 bg-green-50 px-4 py-1 rounded-full mt-1"><ShieldCheck className="w-4 h-4" /> Pending Approvals</span>}
        {filterMode === 'backlog' && <span className="text-lg font-bold text-red-600 flex items-center gap-2 bg-red-50 px-4 py-1 rounded-full mt-1"><AlertTriangle className="w-4 h-4" /> Backlog Alert</span>}
        {filterMode === 'pending_invoice' && <span className="text-lg font-bold text-red-600 flex items-center gap-2 bg-red-50 px-4 py-1 rounded-full mt-1"><FileText className="w-4 h-4" /> Billing Required</span>}
      </div>
      {filterMode === 'date' ? (<button onClick={() => handleDateChange(1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"><ChevronRight className="w-5 h-5" /></button>) : (<button onClick={() => setViewAndFilter('daily-log', 'date', getTodayString())} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors" title="Clear Filter"><X className="w-5 h-5" /></button>)}
    </div>

    {displayedOrders.length === 0 ? (
      <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300 text-slate-400">No records found.</div>
    ) : (
      <div className="space-y-4">
        {displayedOrders.map((order) => (
          <Card key={order.id} className="p-5 flex flex-col md:flex-row md:items-start gap-5 hover:shadow-md transition-shadow relative">
            {((role === 'sale' && order.orderDate >= getTodayString()) || role === 'management') && (
              <div className="absolute top-4 right-4 flex gap-2 z-10">
                <button onClick={(e) => { e.stopPropagation(); handleEditOrder(order); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit Order"><Pencil className="w-4 h-4" /></button>
                <button onClick={(e) => { e.stopPropagation(); triggerDelete(order.id); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete Order"><Trash2 className="w-4 h-4" /></button>
              </div>
            )}

            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 relative">
              {filterMode !== 'date' && <div className="absolute -top-5 left-0"><span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">{formatDateDisplay(order.orderDate)}</span></div>}
              <div><p className="text-xs text-slate-400 uppercase font-bold">Client</p><p className="font-bold text-slate-800">{order.client}</p><p className="text-xs text-slate-500 truncate">{order.location}</p></div>
              <div><p className="text-xs text-slate-400 uppercase font-bold">Vehicle</p><p className="font-semibold text-slate-700 bg-slate-100 inline-block px-2 rounded text-sm">{order.vehicle}</p>{(order.truckType || order.vehicleType) && <span className="ml-2 text-[10px] font-bold text-slate-500 bg-slate-200 px-1.5 rounded">{formatTruckTypeShort(order.truckType || order.vehicleType)}</span>}{order.transporter && <p className="text-[10px] text-slate-400 mt-1 truncate max-w-[120px]">{order.transporter}</p>}</div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-bold">Load Specs</p>
                {(() => {
                  const cbms = [];
                  const sizes = [];
                  const isDispatched = order.status === 'Dispatched';
                  
                  if (isDispatched) {
                    const rawSizes = String(order.size || '').split(',').map(s => s.trim()).filter(Boolean);
                    const additional = Array.isArray(order.additionalProducts) ? order.additionalProducts : [];
                    
                    const totalCbm = parseFloat(order.cbm) || 0;
                    let additionalCbmSum = 0;
                    const additionalCbms = additional.map((p) => {
                      const pCbm = parseFloat(p.cbm) || 0;
                      additionalCbmSum += pCbm;
                      return pCbm;
                    });
                    const primaryCbm = Math.max(0, totalCbm - additionalCbmSum);
                    
                    rawSizes.forEach((sz, idx) => {
                      sizes.push(sz);
                      if (idx === 0) {
                        cbms.push(primaryCbm);
                      } else {
                        cbms.push(additionalCbms[idx - 1] || 0);
                      }
                    });
                  } else {
                    if (order.size) {
                      sizes.push(order.size);
                    }
                    if (order.cbm !== undefined && order.cbm !== null && String(order.cbm).trim() !== '') {
                      cbms.push(parseFloat(order.cbm) || 0);
                    }
                    
                    const additional = Array.isArray(order.additionalProducts) ? order.additionalProducts : [];
                    additional.forEach((p) => {
                      if (p.size) {
                        sizes.push(p.size);
                      }
                      if (p.cbm !== undefined && p.cbm !== null && String(p.cbm).trim() !== '') {
                        cbms.push(parseFloat(p.cbm) || 0);
                      }
                    });
                  }
                  
                  const formattedCbms = cbms.map(c => {
                    const num = parseFloat(c);
                    if (!Number.isFinite(num)) return String(c);
                    return Number(num.toFixed(3)).toString();
                  });
                  
                  const cbmText = formattedCbms.join(', ');
                  const bjmVal = order.bjm;
                  const hasBjm = bjmVal !== undefined && bjmVal !== null && String(bjmVal).trim() !== '' && Number(bjmVal) !== 0 && String(bjmVal).trim() !== '-';
                  
                  return (
                    <>
                      <p className="text-sm text-slate-700 font-semibold">{cbmText} CBM</p>
                      <div className="text-xs text-slate-500 mt-0.5 space-y-0.5">
                        {sizes.map((sz, idx) => (
                          <div key={idx}>{sz}</div>
                        ))}
                        {hasBjm && <div>{Number(bjmVal)} Bags</div>}
                      </div>
                    </>
                  );
                })()}
              </div>
              <div><p className="text-xs text-slate-400 uppercase font-bold">Rate</p><p className="text-sm font-semibold text-slate-700">₹ {order.rate}</p></div>

              {order.status === 'Dispatched' && (
                <div className="col-span-2 md:col-span-4 mt-2 pt-2 border-t border-slate-100 grid grid-cols-3 gap-2">
                  <div><p className="text-[10px] text-slate-400 uppercase font-bold">Net Wt</p><p className="text-xs font-bold text-slate-700 flex items-center"><Scale className="w-3 h-3 mr-1 text-slate-400" /> {order.netWt} kg</p></div>
                  <div><p className="text-[10px] text-slate-400 uppercase font-bold">Loading By</p><p className="text-xs font-bold text-slate-700 flex items-center"><Users className="w-3 h-3 mr-1 text-slate-400" /> {order.loadingBy}</p></div>
                  {((String(order.transporter || '').trim().toUpperCase().startsWith('ABC')) || order.unloadingBy) && (<div><p className="text-[10px] text-slate-400 uppercase font-bold">Unloading By</p><p className="text-xs font-bold text-slate-700 flex items-center"><Users className="w-3 h-3 mr-1 text-slate-400" /> {order.unloadingBy || '-'}</p></div>)}
                </div>
              )}

              <div className="col-span-2 md:col-span-4 mt-2 pt-3 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase font-bold mb-2">Documents</p>
                <div className="flex flex-wrap gap-3">
                  {order.invoice ? <button onClick={() => openPreview('invoice', order.invoice, order.id, false, order.invoiceUrl)} className="flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-100"><FileText className="w-3 h-3 mr-1.5" /> Invoice</button> : <span className="text-xs text-slate-300 italic">No Invoice</span>}
                  {order.dispatchSlip ? <button onClick={() => openPreview('slip', order.dispatchSlip, order.id, false, order.dispatchSlipUrl)} className="flex items-center px-3 py-1.5 bg-purple-50 text-purple-700 text-xs font-bold rounded-lg hover:bg-purple-100"><CheckCircle className="w-3 h-3 mr-1.5" /> Dispatch Slip</button> : <span className="text-xs text-slate-300 italic">No Slip</span>}
                  {order.mtc ? (
                    <button onClick={() => openPreview('mtc', order.mtc, order.id, false, order.mtcUrl)} className="flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg hover:bg-blue-100"><FileText className="w-3 h-3 mr-1.5" /> MTC</button>
                  ) : order.status === 'Dispatched' ? (
                    <span className="text-xs text-red-600 font-bold">Pending MTC</span>
                  ) : (
                    <span className="text-xs text-slate-300 italic">No MTC</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-start pt-2 min-w-[120px] text-center"><StatusBadge status={order.status} /></div>

            <div className="flex flex-col gap-2 min-w-[160px] border-l pl-4 border-slate-100">
              {role === 'sale' && (
                <>
                  {order.status === 'Invoiced' && <button onClick={() => openPreview('invoice', order.invoice || 'Draft', order.id, true, order.invoiceUrl)} className="w-full py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 flex items-center justify-center"><Eye className="w-3 h-3 mr-1.5" /> Review & Approve</button>}
                  {!['Invoiced'].includes(order.status) && <span className="text-xs text-slate-400 text-center italic">Monitoring...</span>}
                </>
              )}
              {role === 'loading' && (
                <>
                  {['Awaiting Truck', 'Truck at Site', 'Loading', 'Loading Complete'].includes(order.status) && <select className="w-full py-1.5 px-2 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded outline-none" value={order.status} onChange={(e) => updateStatus(order.id, e.target.value)}>{getAllowedLoadingStatuses(order.status).map((s) => <option key={s} value={s}>{s}</option>)}</select>}
                  {order.status === 'Loading Complete' && <span className="text-xs text-red-500 font-medium text-center bg-red-50 py-1 rounded">Waiting for Accounts</span>}
                  {order.status === 'Invoiced' && <span className="text-xs text-indigo-500 font-medium text-center bg-indigo-50 py-1 rounded">Waiting for Approval</span>}
                  {order.status === 'Approved' && <button onClick={() => setDispatchModalOrderId(order.id)} className="w-full py-2 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 flex justify-center items-center"><Truck className="w-3 h-3 mr-1.5" /> Dispatch Truck</button>}
                  {order.status === 'Dispatched' && <span className="text-xs text-green-600 font-bold text-center flex items-center justify-center"><CheckCircle className="w-3 h-3 mr-1" /> Done</span>}
                </>
              )}
              {role === 'account' && (
                <>
                  {order.status === 'Loading Complete' && <label className="w-full py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 flex justify-center items-center cursor-pointer"><DollarSign className="w-3 h-3 mr-1" /> Upload Invoice<input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { const selected = e.target.files?.[0]; if (selected) handleFileUpload(order.id, 'invoice', 'Invoiced', selected); e.target.value = ''; }} /></label>}
                  {order.status === 'Dispatched' && !order.mtc && <button onClick={() => setMtcModalOrderId(order.id)} className="w-full py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 flex justify-center items-center"><FileText className="w-3 h-3 mr-1.5" /> Generate MTC</button>}
                  {order.status !== 'Loading Complete' && !order.invoice && <span className="text-xs text-slate-400 text-center italic">Wait for Loading Tm.</span>}
                </>
              )}
              {role === 'management' && (
                <>
                  {['Awaiting Truck', 'Truck at Site', 'Loading', 'Loading Complete'].includes(order.status) && <select className="w-full py-1.5 px-2 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded outline-none" value={order.status} onChange={(e) => updateStatus(order.id, e.target.value)}>{getAllowedLoadingStatuses(order.status).map((s) => <option key={s} value={s}>{s}</option>)}</select>}
                  {order.status === 'Loading Complete' && <label className="w-full py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 flex justify-center items-center cursor-pointer"><DollarSign className="w-3 h-3 mr-1" /> Upload Invoice<input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { const selected = e.target.files?.[0]; if (selected) handleFileUpload(order.id, 'invoice', 'Invoiced', selected); e.target.value = ''; }} /></label>}
                  {order.status === 'Invoiced' && <button onClick={() => openPreview('invoice', order.invoice || 'Draft', order.id, true, order.invoiceUrl)} className="w-full py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 flex items-center justify-center"><Eye className="w-3 h-3 mr-1.5" /> Review & Approve</button>}
                  {order.status === 'Dispatched' && !order.mtc && <button onClick={() => setMtcModalOrderId(order.id)} className="w-full py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 flex justify-center items-center"><FileText className="w-3 h-3 mr-1.5" /> Generate MTC</button>}
                  {order.status === 'Approved' && <button onClick={() => setDispatchModalOrderId(order.id)} className="w-full py-2 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 flex justify-center items-center"><Truck className="w-3 h-3 mr-1.5" /> Dispatch Truck</button>}
                  {order.status === 'Dispatched' && <span className="text-xs text-green-600 font-bold text-center flex items-center justify-center"><CheckCircle className="w-3 h-3 mr-1" /> Done</span>}
                  {!['Awaiting Truck', 'Truck at Site', 'Loading', 'Loading Complete', 'Invoiced', 'Approved', 'Dispatched'].includes(order.status) && <span className="text-xs text-slate-400 text-center italic">{order.status}</span>}
                </>
              )}
            </div>
          </Card>
        ))}
      </div>
    )}
  </div>
  );
};
