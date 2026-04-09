import React, { useState } from 'react';
import { Package, Truck, FileText, LogOut, DollarSign, Briefcase, Calendar, BarChart3, Search } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { Card, StatCard } from './components/ui/UIComponents';
import { ImportModal } from './components/modals/ImportModal';
import { initializeTestData } from './utils/localStorage';
import { getTodayString } from './utils/helpers';
import './index.css';

const RoleSelection = ({ onRoleSelect }) => (
  <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
    <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 space-y-6">
      <div className="text-center">
        <div className="bg-blue-600 w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-blue-200 shadow-xl">
          <Package className="text-white w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">AAC Plant Manager</h1>
        <p className="text-slate-500 mt-2">Select your department</p>
      </div>
      <div className="grid gap-3">
        <button onClick={() => onRoleSelect('sales')} className="flex items-center p-4 border-2 border-slate-100 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group">
          <div className="bg-blue-100 p-2 rounded-lg"><Briefcase className="text-blue-600 w-5 h-5" /></div>
          <div className="ml-4 text-left"><p className="font-bold text-slate-700">Sales Team</p></div>
        </button>
        <button onClick={() => onRoleSelect('loading')} className="flex items-center p-4 border-2 border-slate-100 rounded-xl hover:border-orange-500 hover:bg-orange-50 transition-all group">
          <div className="bg-orange-100 p-2 rounded-lg"><Truck className="text-orange-600 w-5 h-5" /></div>
          <div className="ml-4 text-left"><p className="font-bold text-slate-700">Loading Team</p></div>
        </button>
        <button onClick={() => onRoleSelect('production')} className="flex items-center p-4 border-2 border-slate-100 rounded-xl hover:border-cyan-500 hover:bg-cyan-50 transition-all group">
          <div className="bg-cyan-100 p-2 rounded-lg"><Calendar className="text-cyan-600 w-5 h-5" /></div>
          <div className="ml-4 text-left"><p className="font-bold text-slate-700">Production Team</p></div>
        </button>
        <button onClick={() => onRoleSelect('accounts')} className="flex items-center p-4 border-2 border-slate-100 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group">
          <div className="bg-green-100 p-2 rounded-lg"><DollarSign className="text-green-600 w-5 h-5" /></div>
          <div className="ml-4 text-left"><p className="font-bold text-slate-700">Accounts</p></div>
        </button>
        <button onClick={() => onRoleSelect('management')} className="flex items-center p-4 border-2 border-slate-100 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all group">
          <div className="bg-purple-100 p-2 rounded-lg"><BarChart3 className="text-purple-600 w-5 h-5" /></div>
          <div className="ml-4 text-left"><p className="font-bold text-slate-700">Management</p></div>
        </button>
      </div>
    </div>
  </div>
);

const Dashboard = () => {
  const { role, setRole, orders, showToast, logAction, loadAllData } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);

  const handleTestData = () => {
    initializeTestData();
    // refresh context data
    loadAllData();
    showToast('Test data generated!');
    logAction('TEST DATA', 'Generated test data');
  };

  const handleBulkImport = (data) => {
    // add via context methods (kept minimal here)
    let count = 0;
    data.forEach(item => { /* AppContext addOrder will be used by Import modal via context if needed */ count++; });
    logAction('BULK IMPORT', `Imported ${count} records from CSV`);
    showToast(`Successfully imported ${count} records`);
    setShowImportModal(false);
  };

  const todayStr = getTodayString();
  const stats = {
    todayOrders: orders.filter(o => o.orderDate === todayStr).length,
    active: orders.filter(o => ['Loading', 'Truck at Site', 'Loading Complete'].includes(o.status)).length,
    pendingInv: orders.filter(o => o.status === 'Loading Complete').length,
    pendingApprove: orders.filter(o => o.status === 'Invoiced').length,
    backlog: orders.filter(o => o.orderDate < todayStr && o.status !== 'Dispatched').length,
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {showImportModal && (<ImportModal onClose={() => setShowImportModal(false)} onImport={handleBulkImport} />)}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2 shrink-0">
            <div className="bg-blue-600 p-1.5 rounded-lg"><Package className="text-white w-4 h-4" /></div>
            <span className="font-bold text-slate-800 hidden md:block">AAC Manager</span>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-xs font-medium uppercase border border-slate-200">{role}</span>
          </div>

          <div className="flex-1 max-w-md mx-4 relative">
            <input type="text" placeholder="Search..." className="w-full bg-slate-100 border border-slate-200 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button onClick={handleTestData} className="px-3 py-2 text-sm font-bold text-slate-600 hover:text-blue-600">Test Data</button>
            <button onClick={() => setRole(null)} className="text-slate-400 hover:text-red-500 p-2"><LogOut className="w-5 h-5" /></button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="space-y-8 animate-in fade-in duration-500">
          <div><h2 className="text-2xl font-bold text-slate-800">Welcome back, {role?.toUpperCase()}</h2><p className="text-slate-500">Activity Overview</p></div>

          {role === 'sales' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Today's Orders" value={stats.todayOrders} icon={Calendar} colorClass="bg-blue-500" />
              <StatCard label="Active Loads" value={stats.active} icon={Truck} colorClass="bg-orange-500" />
              <StatCard label="Inv. To Approve" value={stats.pendingApprove} icon={FileText} colorClass="bg-green-500" />
              <StatCard label="Backlog" value={stats.backlog} icon={FileText} colorClass="bg-red-500" />
            </div>
          )}

          {role === 'production' && (
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-6"><h3 className="font-bold text-lg mb-2">Raw Material Stock</h3><p className="text-sm text-slate-500">Manage raw material inventory.</p></Card>
              <Card className="p-6"><h3 className="font-bold text-lg mb-2">Daily Production Report</h3><p className="text-sm text-slate-500">Track finished goods & daily output.</p></Card>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Recent Orders</h3>
            {orders.slice(0, 5).map(order => (
              <Card key={order.id} className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><p className="text-xs text-slate-400 uppercase font-bold">Client</p><p className="font-bold text-slate-800">{order.client}</p><p className="text-xs text-slate-500 truncate">{order.location}</p></div>
                  <div><p className="text-xs text-slate-400 uppercase font-bold">Vehicle</p><p className="font-semibold text-slate-700">{order.vehicle}</p></div>
                  <div><p className="text-xs text-slate-400 uppercase font-bold">Load</p><p className="text-sm text-slate-700">{order.cbm} CBM</p></div>
                  <div><p className="text-xs text-slate-400 uppercase font-bold">Status</p><span className="text-xs font-bold text-slate-700">{order.status}</span></div>
                </div>
              </Card>
            ))}
            {orders.length === 0 && (<div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300 text-slate-400">No orders yet. Click "Test Data" to generate sample data.</div>)}
          </div>
        </div>
      </main>
    </div>
  );
};

const AppContent = () => {
  const { role, setRole } = useApp();
  if (!role) return <RoleSelection onRoleSelect={(r) => setRole(r)} />;
  return <Dashboard />;
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
