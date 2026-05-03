import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { admin } from '../../api';
import { useAuthContext } from '../../contexts/useAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldAlert, Trash2, Ban, CheckCircle2, RefreshCw, Activity, User as UserIcon, Undo2, Users, Globe, History, BarChart3, Music, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import RequestLogger from './RequestLogger';
import ConfirmModal from '../shared/ConfirmModal';
import PromptModal from '../shared/PromptModal';
import BanUserModal from './BanUserModal';
import AppealDetailsModal from './AppealDetailsModal';

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuthContext();
  const [activeTab, setActiveTab] = useState('users'); // users, ips, audit, monitor
  
  // Data States
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [bannedIps, setBannedIps] = useState([]);
  const [bannedDevices, setBannedDevices] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  
  // UI States
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showLogger, setShowLogger] = useState(false);
  const [ipForm, setIpForm] = useState({ ip: '', reason: '' });
  const [deviceForm, setDeviceForm] = useState({ deviceId: '', reason: '' });

  // Modal States
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: '', user: null, ipId: null, deviceId: null });
  const [banModal, setBanModal] = useState({ isOpen: false, user: null });
  const [appealModal, setAppealModal] = useState({ isOpen: false, user: null });

  const fetchStats = async () => {
    try {
      const data = await admin.getStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { users: fetchedUsers } = await admin.getUsers({ 
        search, 
        role: roleFilter, 
        status: statusFilter 
      });
      setUsers(fetchedUsers);
    } catch (error) {
      toast.error(t('admin.toast.fetchError'));
    } finally {
      setLoading(false);
    }
  };

  const fetchIps = async () => {
    setLoading(true);
    try {
      const data = await admin.getBannedIps();
      setBannedIps(data);
    } catch (err) {
      toast.error(t('admin.toast.fetchError'));
    } finally {
      setLoading(false);
    }
  };

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const data = await admin.getBannedDevices();
      setBannedDevices(data);
    } catch (err) {
      toast.error(t('admin.toast.fetchError'));
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const { logs } = await admin.getAuditLogs({ limit: 50 });
      setAuditLogs(logs);
    } catch (err) {
      toast.error(t('admin.toast.fetchError'));
    } finally {
      setLoading(false);
    }
  };

  const fetchData = () => {
    fetchStats();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'ips') fetchIps();
    if (activeTab === 'devices') fetchDevices();
    if (activeTab === 'audit') fetchAuditLogs();
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'users') return;
    const timer = setTimeout(() => {
      fetchUsers();
    }, 500);
    return () => clearTimeout(timer);
  }, [search, roleFilter, statusFilter]);

  const handleToggleBan = async (user) => {
    if (user.id === currentUser?.id || user._id === currentUser?._id) {
      toast.error(t('admin.toast.noSelfAction'));
      return;
    }

    if (user.isBanned) {
      try {
        await admin.unbanUser(user.id || user._id);
        toast.success(t('admin.toast.unbannedSuccess', { name: user.username }));
        setAppealModal({ isOpen: false, user: null });
        fetchUsers();
      } catch (err) {
        toast.error(t('admin.toast.statusError'));
      }
    } else {
      setBanModal({ isOpen: true, user });
    }
  };

  const handleRejectAppeal = async (user) => {
    try {
      await admin.rejectAppeal(user.id || user._id);
      toast.success(t('admin.toast.appealRejectedSuccess', { name: user.username }));
      setAppealModal({ isOpen: false, user: null });
      fetchUsers();
    } catch (err) {
      toast.error(t('admin.toast.statusError'));
    }
  };

  const handleReactivate = async (user) => {
    try {
      await admin.reactivateUser(user.id || user._id);
      toast.success(t('admin.toast.reactivateSuccess', { name: user.username }));
      fetchUsers();
    } catch (err) {
      toast.error(t('admin.toast.statusError'));
    }
  };

  const onBanConfirm = async ({ reason, bannedUntil, banIp, banDevice }) => {
    const { user } = banModal;
    setBanModal({ isOpen: false, user: null });
    try {
      await admin.banUser(user.id || user._id, { reason, bannedUntil, banIp, banDevice });
      toast.success(t('admin.toast.bannedSuccess', { name: user.username }));
      fetchUsers();
      fetchStats();
    } catch (err) {
      toast.error(t('admin.toast.statusError'));
    }
  };

  const handleChangeRole = (user) => {
    if (user.id === currentUser?.id || user._id === currentUser?._id) {
      toast.error(t('admin.toast.noSelfAction'));
      return;
    }
    setConfirmModal({ isOpen: true, type: 'role', user });
  };

  const handleDelete = (user) => {
    if (user.id === currentUser?.id || user._id === currentUser?._id) {
      toast.error(t('admin.toast.noSelfAction'));
      return;
    }
    setConfirmModal({ isOpen: true, type: 'delete', user });
  };

  const handleBlockIp = async (e) => {
    e.preventDefault();
    if (!ipForm.ip) return;
    try {
      await admin.blockIp(ipForm.ip, ipForm.reason);
      toast.success('IP blocked successfully');
      setIpForm({ ip: '', reason: '' });
      fetchIps();
      fetchStats();
    } catch (err) {
      toast.error(err.message || 'Failed to block IP');
    }
  };

  const handleUnblockIp = (ipId) => {
    setConfirmModal({ isOpen: true, type: 'unblock_ip', ipId });
  };

  const handleBlockDevice = async (e) => {
    e.preventDefault();
    if (!deviceForm.deviceId) return;
    try {
      await admin.blockDevice(deviceForm.deviceId, deviceForm.reason);
      toast.success('Device blocked successfully');
      setDeviceForm({ deviceId: '', reason: '' });
      fetchDevices();
      fetchStats();
    } catch (err) {
      toast.error(err.message || 'Failed to block device');
    }
  };

  const handleUnblockDevice = (deviceId) => {
    setConfirmModal({ isOpen: true, type: 'unblock_device', deviceId });
  };

  const onConfirmAction = async () => {
    const { type, user, ipId, deviceId } = confirmModal;
    setConfirmModal({ isOpen: false, type: '', user: null, ipId: null, deviceId: null });
    
    try {
      if (type === 'role') {
        const newRole = user.role === 'admin' ? 'user' : 'admin';
        await admin.changeRole(user.id || user._id, newRole);
        toast.success(t('admin.toast.roleSuccess', { name: user.username, role: newRole }));
      } else if (type === 'delete') {
        await admin.deleteUser(user.id || user._id);
        toast.success(t('admin.toast.deleteSuccess', { name: user.username }));
      } else if (type === 'unblock_ip') {
        await admin.unblockIp(ipId);
        toast.success('IP unblocked successfully');
        fetchIps();
        fetchStats();
      } else if (type === 'unblock_device') {
        await admin.unblockDevice(deviceId);
        toast.success('Device unblocked successfully');
        fetchDevices();
        fetchStats();
      }
      fetchUsers();
    } catch (err) {
      toast.error(t('admin.toast.statusError'));
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 p-6 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 flex items-center gap-3">
            <ShieldAlert className="text-indigo-400 w-8 h-8" />
            {t('admin.dashboard.title')}
          </h1>
          <p className="text-zinc-500 mt-1">{t('admin.dashboard.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={fetchData}>
            <RefreshCw className={`w-5 h-5 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {[
          { label: t('admin.dashboard.stats.total'), value: stats?.totalUsers, icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10' },
          { label: t('admin.dashboard.stats.active'), value: stats?.activeUsers, icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
          { label: t('admin.dashboard.stats.appeals'), value: stats?.pendingAppeals, icon: FileText, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
          { label: t('admin.dashboard.stats.banned'), value: stats?.bannedUsers, icon: Ban, color: 'text-red-400', bg: 'bg-red-400/10' },
          { label: t('admin.dashboard.stats.deleted'), value: stats?.deletedUsers, icon: Trash2, color: 'text-zinc-500', bg: 'bg-zinc-500/10' },
        ].map((s, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center gap-4 hover:border-zinc-700 transition-colors">
            <div className={`p-3 rounded-xl ${s.bg}`}>
              <s.icon className={`w-6 h-6 ${s.color}`} />
            </div>
            <div>
              <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">{s.label}</p>
              <p className="text-2xl font-bold text-zinc-100">{s.value ?? '—'}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800 w-fit mb-6">
        {[
          { id: 'users', icon: Users, label: t('admin.dashboard.tabs.users') },
          { id: 'ips', icon: Globe, label: t('admin.dashboard.tabs.ipBlocklist') },
          { id: 'devices', icon: ShieldAlert, label: t('admin.dashboard.tabs.deviceBlocklist') },
          { id: 'audit', icon: History, label: t('admin.dashboard.tabs.auditLogs') },
          { id: 'monitor', icon: Activity, label: t('admin.dashboard.tabs.requestLogger') },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id 
                ? 'bg-zinc-800 text-zinc-100 shadow-lg ring-1 ring-zinc-700' 
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl flex-1 flex flex-col min-h-[400px] overflow-hidden">
        {activeTab === 'users' && (
          <>
            <div className="p-4 border-b border-zinc-800/50 flex flex-wrap items-center gap-4 bg-zinc-900/50">
              <div className="relative flex-1 max-w-md">
                <Input 
                  placeholder={t('admin.dashboard.searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 focus:border-indigo-500 pl-10"
                />
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              </div>
              <select 
                value={roleFilter} 
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 outline-none focus:border-indigo-500"
              >
                <option value="">{t('admin.dashboard.filters.allRoles')}</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 outline-none focus:border-indigo-500"
              >
                <option value="">{t('admin.dashboard.filters.allStatuses')}</option>
                <option value="active">{t('admin.dashboard.filters.active')}</option>
                <option value="banned">{t('admin.dashboard.filters.banned')}</option>
                <option value="deleted">{t('admin.dashboard.filters.deleted')}</option>
                <option value="verified">{t('admin.dashboard.filters.verified')}</option>
                <option value="premium">{t('admin.dashboard.filters.premium')}</option>
              </select>
            </div>

            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800/50 bg-zinc-950/30">
                    <th className="p-4 font-semibold text-zinc-500 text-[10px] uppercase tracking-widest">{t('admin.table.user')}</th>
                    <th className="p-4 font-semibold text-zinc-500 text-[10px] uppercase tracking-widest">{t('admin.table.role')}</th>
                    <th className="p-4 font-semibold text-zinc-500 text-[10px] uppercase tracking-widest">{t('admin.table.status')}</th>
                    <th className="p-4 font-semibold text-zinc-500 text-[10px] uppercase tracking-widest">{t('admin.table.projects')} / {t('admin.table.uploads')}</th>
                    <th className="p-4 font-semibold text-zinc-500 text-[10px] uppercase tracking-widest">{t('admin.table.ip')} / {t('admin.table.flags')}</th>
                    <th className="p-4 font-semibold text-zinc-500 text-[10px] uppercase tracking-widest text-right">{t('admin.table.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/30">
                  {users.map(user => {
                    const isSelf = user.id === currentUser?.id;
                    return (
                      <tr key={user.id} className={`group hover:bg-zinc-800/30 transition-colors ${user.isDeleted ? 'opacity-50 grayscale-[0.5]' : ''}`}>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold overflow-hidden border border-zinc-700">
                              {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover" /> : user.username[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-zinc-200">{user.username}</span>
                                {isSelf && <span className="text-[9px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">You</span>}
                              </div>
                              <div className="text-xs text-zinc-500">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <button 
                            disabled={isSelf}
                            onClick={() => handleChangeRole(user)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${
                              user.role === 'admin' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                            }`}
                          >
                            {user.role}
                          </button>
                        </td>
                        <td className="p-4">
                          {user.isBanned ? (
                            <div className="flex flex-col">
                              <span className="flex items-center gap-1.5 text-xs text-red-400 font-medium"><Ban className="w-3 h-3" /> {t('admin.table.banned')}</span>
                              <span className="text-[10px] text-zinc-600 line-clamp-1 italic" title={user.banReason}>{user.banReason}</span>
                            </div>
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium"><CheckCircle2 className="w-3 h-3" /> {t('admin.table.active')}</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-4 text-xs font-medium">
                            <div className="flex items-center gap-1.5 text-zinc-300">
                              <BarChart3 className="w-3.5 h-3.5 text-zinc-500" /> {user.projectCount}
                            </div>
                            <div className="flex items-center gap-1.5 text-zinc-300">
                              <Music className="w-3.5 h-3.5 text-zinc-500" /> {user.uploadCount}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1.5">
                            <span className="font-mono text-[10px] text-zinc-500">{user.lastIp || '—'}</span>
                            <div className="flex items-center gap-1.5">
                              {user.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" title={t('admin.table.verified')} />}
                              {user.spotify?.connected && <Activity className={`w-3.5 h-3.5 ${user.spotify?.isPremium ? 'text-emerald-400' : 'text-zinc-600'}`} title={t('admin.table.spotify')} />}
                              {user.isDeleted && <Trash2 className="w-3.5 h-3.5 text-red-500" title={t('admin.table.deleted')} />}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!isSelf && (
                              <>
                                {user.isDeleted ? (
                                  <Button variant="ghost" size="sm" onClick={() => handleReactivate(user)} className="h-8 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 gap-1.5">
                                    <Undo2 className="w-3.5 h-3.5" /> {t('admin.table.reactivate')}
                                  </Button>
                                ) : (
                                  <>
                                    {user.banAppeal ? (
                                      <Button variant="secondary" size="sm" onClick={() => setAppealModal({ isOpen: true, user })} className="h-8 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 border-yellow-500/30 gap-1.5">
                                        <Info className="w-3.5 h-3.5" /> Review Appeal
                                      </Button>
                                    ) : (
                                      !user.isBanned && (
                                        <Button variant="ghost" size="sm" onClick={() => handleToggleBan(user)} className="h-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1.5">
                                          <Ban className="w-3.5 h-3.5" /> {t('admin.table.ban')}
                                        </Button>
                                      )
                                    )}
                                    {user.isBanned && !user.banAppeal && (
                                      <Button variant="ghost" size="sm" onClick={() => handleToggleBan(user)} className="h-8 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10">
                                        {t('admin.table.unban')}
                                      </Button>
                                    )}
                                    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(user)} className="w-8 h-8 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg">
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'ips' && (
          <div className="p-6 flex flex-col h-full gap-6">
            <form onSubmit={handleBlockIp} className="flex flex-wrap items-end gap-4 bg-zinc-950/50 p-4 rounded-xl border border-zinc-800">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">{t('admin.table.blockIp')}</label>
                <Input 
                  placeholder={t('admin.table.ipPlaceholder')}
                  value={ipForm.ip}
                  onChange={(e) => setIpForm({ ...ipForm, ip: e.target.value })}
                  className="bg-zinc-900 border-zinc-800"
                />
              </div>
              <div className="flex-[2] min-w-[300px]">
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">{t('admin.table.ipReason')}</label>
                <Input 
                  placeholder={t('admin.table.reasonPlaceholder')}
                  value={ipForm.reason}
                  onChange={(e) => setIpForm({ ...ipForm, reason: e.target.value })}
                  className="bg-zinc-900 border-zinc-800"
                />
              </div>
              <Button type="submit" disabled={!ipForm.ip} className="bg-red-600 hover:bg-red-500 text-white gap-2">
                <Ban className="w-4 h-4" /> {t('admin.table.ban')}
              </Button>
            </form>

            <div className="flex-1 overflow-y-auto">
              {bannedIps.length === 0 ? (
                <div className="text-center p-12 text-zinc-500">{t('admin.dashboard.noUsers')}</div>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-zinc-800/50 bg-zinc-950/30">
                      <th className="p-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">IP Address</th>
                      <th className="p-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Reason</th>
                      <th className="p-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Added</th>
                      <th className="p-4 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/30">
                    {bannedIps.map(item => (
                      <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="p-4 font-mono text-sm text-red-400 font-bold">{item.ip}</td>
                        <td className="p-4 text-xs text-zinc-400 italic">"{item.reason || 'No reason'}"</td>
                        <td className="p-4 text-[10px] text-zinc-500">{new Date(item.createdAt).toLocaleString()}</td>
                        <td className="p-4 text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleUnblockIp(item.id)}
                            className="text-emerald-500 hover:bg-emerald-500/10 h-8"
                          >
                            {t('admin.table.unblock')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === 'devices' && (
          <div className="p-6 flex flex-col h-full gap-6">
            <form onSubmit={handleBlockDevice} className="flex flex-wrap items-end gap-4 bg-zinc-950/50 p-4 rounded-xl border border-zinc-800">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">{t('admin.table.device')}</label>
                <Input 
                  placeholder="dv_..."
                  value={deviceForm.deviceId}
                  onChange={(e) => setDeviceForm({ ...deviceForm, deviceId: e.target.value })}
                  className="bg-zinc-900 border-zinc-800"
                />
              </div>
              <div className="flex-[2] min-w-[300px]">
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">{t('admin.table.ipReason')}</label>
                <Input 
                  placeholder={t('admin.table.reasonPlaceholder')}
                  value={deviceForm.reason}
                  onChange={(e) => setDeviceForm({ ...deviceForm, reason: e.target.value })}
                  className="bg-zinc-900 border-zinc-800"
                />
              </div>
              <Button type="submit" disabled={!deviceForm.deviceId} className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2">
                <Ban className="w-4 h-4" /> {t('admin.table.ban')}
              </Button>
            </form>

            <div className="flex-1 overflow-y-auto">
              {bannedDevices.length === 0 ? (
                <div className="text-center p-12 text-zinc-500">{t('admin.dashboard.noUsers')}</div>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-zinc-800/50 bg-zinc-950/30">
                      <th className="p-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Device ID</th>
                      <th className="p-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Reason</th>
                      <th className="p-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Added</th>
                      <th className="p-4 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/30">
                    {bannedDevices.map(item => (
                      <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="p-4 font-mono text-xs text-indigo-400 font-bold">{item.deviceId}</td>
                        <td className="p-4 text-xs text-zinc-400 italic">"{item.reason || 'No reason'}"</td>
                        <td className="p-4 text-[10px] text-zinc-500">{new Date(item.createdAt).toLocaleString()}</td>
                        <td className="p-4 text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleUnblockDevice(item.id)}
                            className="text-emerald-500 hover:bg-emerald-500/10 h-8"
                          >
                            {t('admin.table.unblock')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {auditLogs.length === 0 ? (
                <div className="p-12 text-center text-zinc-500">{t('admin.table.noAuditLogs')}</div>
              ) : (
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-zinc-900 shadow-sm border-b border-zinc-800 z-10">
                    <tr>
                      <th className="p-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('admin.table.date')}</th>
                      <th className="p-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('admin.table.admin')}</th>
                      <th className="p-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('admin.table.action')}</th>
                      <th className="p-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('admin.table.target')}</th>
                      <th className="p-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('admin.table.details')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/20">
                    {auditLogs.map(log => (
                      <tr key={log._id} className="hover:bg-zinc-800/20 transition-colors">
                        <td className="p-4 text-[10px] text-zinc-500 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="p-4">
                          <span className="text-xs font-bold text-indigo-400">{log.adminName}</span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            log.action.includes('ban') ? 'bg-red-500/10 text-red-400' :
                            log.action.includes('unban') || log.action.includes('reactivate') ? 'bg-emerald-500/10 text-emerald-400' :
                            'bg-zinc-800 text-zinc-400'
                          }`}>
                            {log.action.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-xs text-zinc-200">{log.targetName || '—'}</span>
                        </td>
                        <td className="p-4 text-xs text-zinc-500 max-w-xs truncate" title={log.details}>
                          {log.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === 'monitor' && (
          <RequestLogger mode="inline" />
        )}
      </div>

      {/* Confirm Action Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={
          confirmModal.type === 'role' ? t('admin.table.roleTitle') : 
          confirmModal.type === 'unblock_ip' ? t('admin.table.unblock') :
          confirmModal.type === 'unblock_device' ? t('admin.table.unblock') :
          t('admin.table.deleteTitle')
        }
        message={
          confirmModal.type === 'role' 
            ? t('admin.table.confirmRoleChange', { name: confirmModal.user?.username, role: confirmModal.user?.role === 'admin' ? 'user' : 'admin' }) 
            : confirmModal.type === 'unblock_ip'
            ? "Are you sure you want to remove this IP block? This network will be able to register and login again."
            : confirmModal.type === 'unblock_device'
            ? "Are you sure you want to remove this hardware block? This machine will be able to access the platform again."
            : t('admin.table.confirmDelete', { name: confirmModal.user?.username })
        }
        onConfirm={onConfirmAction}
        onCancel={() => setConfirmModal({ isOpen: false, type: '', user: null, ipId: null, deviceId: null })}
      />

      <BanUserModal
        isOpen={banModal.isOpen}
        user={banModal.user}
        onConfirm={onBanConfirm}
        onCancel={() => setBanModal({ isOpen: false, user: null })}
      />

      <AppealDetailsModal
        isOpen={appealModal.isOpen}
        user={appealModal.user}
        onApprove={handleToggleBan}
        onReject={handleRejectAppeal}
        onCancel={() => setAppealModal({ isOpen: false, user: null })}
      />
    </div>
  );
}
