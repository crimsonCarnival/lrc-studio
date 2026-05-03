import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { admin } from '../../api';
import { useAuthContext } from '../../contexts/useAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldAlert, Trash2, Ban, CheckCircle2, RefreshCw, Activity, User as UserIcon, Undo2 } from 'lucide-react';
import toast from 'react-hot-toast';
import RequestLogger from './RequestLogger';
import ConfirmModal from '../shared/ConfirmModal';
import PromptModal from '../shared/PromptModal';
import BanUserModal from './BanUserModal';
import AppealDetailsModal from './AppealDetailsModal';

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuthContext();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showLogger, setShowLogger] = useState(false);

  // Modal States
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: '', user: null });
  const [banModal, setBanModal] = useState({ isOpen: false, user: null });
  const [appealModal, setAppealModal] = useState({ isOpen: false, user: null });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { users: fetchedUsers } = await admin.getUsers({ search });
      setUsers(fetchedUsers);
    } catch (error) {
      toast.error(t('admin.toast.fetchError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

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

  const onBanConfirm = async ({ reason, bannedUntil, banIp }) => {
    const { user } = banModal;
    setBanModal({ isOpen: false, user: null });
    try {
      await admin.banUser(user.id || user._id, { reason, bannedUntil, banIp });
      toast.success(t('admin.toast.bannedSuccess', { name: user.username }));
      fetchUsers();
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

  const onConfirmAction = async () => {
    const { type, user } = confirmModal;
    setConfirmModal({ isOpen: false, type: '', user: null });
    
    try {
      if (type === 'role') {
        const newRole = user.role === 'admin' ? 'user' : 'admin';
        await admin.changeRole(user.id || user._id, newRole);
        toast.success(t('admin.toast.roleSuccess', { name: user.username, role: newRole }));
      } else if (type === 'delete') {
        await admin.deleteUser(user.id || user._id);
        toast.success(t('admin.toast.deleteSuccess', { name: user.username }));
      }
      fetchUsers();
    } catch (err) {
      toast.error(type === 'role' ? t('admin.toast.roleError') : t('admin.toast.deleteError'));
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <ShieldAlert className="text-indigo-400" />
            {t('admin.dashboard.title')}
          </h1>
          <p className="text-zinc-500 text-sm mt-1">{t('admin.dashboard.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant={showLogger ? "primary" : "secondary"}
            onClick={() => setShowLogger(!showLogger)}
            className="flex items-center gap-2"
          >
            <Activity className="w-4 h-4" />
            {t('admin.dashboard.requestLogger')}
          </Button>
          <Button variant="ghost" size="icon" onClick={fetchUsers}>
            <RefreshCw className="w-4 h-4 text-zinc-400" />
          </Button>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col flex-1 min-h-0 overflow-hidden relative">
        <div className="p-4 border-b border-zinc-800/50 flex items-center gap-4">
          <Input 
            placeholder={t('admin.dashboard.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md bg-zinc-950"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-zinc-500 flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-zinc-600" />
              {t('admin.dashboard.loading')}
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">{t('admin.dashboard.noUsers')}</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800/50 bg-zinc-900/50">
                  <th className="p-4 font-semibold text-zinc-400 text-xs uppercase tracking-wider">{t('admin.table.user')}</th>
                  <th className="p-4 font-semibold text-zinc-400 text-xs uppercase tracking-wider">{t('admin.table.role')}</th>
                  <th className="p-4 font-semibold text-zinc-400 text-xs uppercase tracking-wider">{t('admin.table.status')}</th>
                  <th className="p-4 font-semibold text-zinc-400 text-xs uppercase tracking-wider">{t('admin.table.appeal')}</th>
                  <th className="p-4 font-semibold text-zinc-400 text-xs uppercase tracking-wider">{t('admin.table.joined')}</th>
                  <th className="p-4 font-semibold text-zinc-400 text-xs uppercase tracking-wider">{t('admin.table.ip')}</th>
                  <th className="p-4 font-semibold text-zinc-400 text-xs uppercase tracking-wider">{t('admin.table.flags')}</th>
                  <th className="p-4 font-semibold text-zinc-400 text-xs uppercase tracking-wider text-right">{t('admin.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/30">
                {users.map(user => {
                  const userId = user.id || user._id?.toString();
                  const currentUserId = currentUser?.id || currentUser?._id?.toString();
                  const isSelf = userId === currentUserId;
                  const spotifyConnected = !!user.spotify?.spotifyId;
                  
                  return (
                    <tr key={user.id || user._id} className={`transition-colors ${user.isDeleted ? 'opacity-50 bg-red-950/20' : 'hover:bg-zinc-800/30'}`}>
                      <td className="p-4">
                        <div className="flex items-center gap-2 font-medium text-zinc-200">
                          {user.username} {user.isDeleted && <span className="text-[10px] text-red-400 font-bold uppercase tracking-tighter ml-1">({t('admin.table.deleted')})</span>}
                          {isSelf && <span className="text-[10px] bg-zinc-700 text-zinc-400 px-1.5 rounded uppercase tracking-tighter">You</span>}
                        </div>
                        <div className="text-xs text-zinc-500">{user.email || t('admin.table.noEmail')}</div>
                      </td>
                      <td className="p-4">
                        {isSelf ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-400">
                            {user.role}
                          </span>
                        ) : (
                          <button 
                            onClick={() => handleChangeRole(user)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all hover:ring-1 hover:ring-zinc-400 ${
                              user.role === 'admin' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {user.role}
                          </button>
                        )}
                      </td>
                      <td className="p-4">
                        {user.isBanned ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
                              <Ban className="w-3.5 h-3.5" /> {t('admin.table.banned')}
                            </span>
                            {user.banReason && (
                              <span className="text-[10px] text-zinc-500 italic truncate max-w-[150px]" title={user.banReason}>
                                {user.banReason}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {t('admin.table.active')}
                          </span>
                        )}
                      </td>
                      <td className="p-4 max-w-[200px]">
                        {user.banAppeal ? (
                          <button 
                            onClick={() => setAppealModal({ isOpen: true, user })}
                            className="flex flex-col gap-0.5 text-left group hover:bg-zinc-800/50 p-1.5 -m-1.5 rounded-lg transition-all w-full"
                          >
                            <span className="italic text-yellow-200 line-clamp-2 group-hover:text-yellow-100 transition-colors" title={user.banAppeal}>
                              "{user.banAppeal}"
                            </span>
                            {user.appealAt && (
                              <span className="text-[10px] text-zinc-500 group-hover:text-zinc-400">
                                {new Date(user.appealAt).toLocaleDateString()}
                              </span>
                            )}
                          </button>
                        ) : (
                          <span className="text-zinc-600 text-xs px-1.5">{t('admin.table.noAppeal')}</span>
                        )}
                      </td>
                      <td className="p-4 text-xs text-zinc-400">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4 font-mono text-[10px] text-zinc-500">
                        {user.lastIp || '—'}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {user.isVerified && (
                            <div className="text-emerald-500" title={t('admin.table.verified')}>
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                          )}
                          {spotifyConnected && (
                            <div className={`${user.spotify?.isPremium ? 'text-emerald-400' : 'text-zinc-500'}`} title={t('admin.table.spotify')}>
                              <Activity className="w-4 h-4" />
                            </div>
                          )}
                          {user.isDeleted && (
                            <div className="text-red-500" title={t('admin.table.deleted')}>
                              <Trash2 className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        {!isSelf && (
                          <div className="flex items-center justify-end gap-2">
                            {user.isDeleted ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleReactivate(user)}
                                className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 h-8 gap-1.5"
                              >
                                <Undo2 className="w-3.5 h-3.5" />
                                {t('admin.table.reactivate')}
                              </Button>
                            ) : (
                              <>
                                {!user.isBanned && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleToggleBan(user)}
                                    disabled={user.role === 'admin'}
                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 gap-1.5"
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                    {t('admin.table.ban')}
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => handleDelete(user)}
                                  disabled={user.role === 'admin'}
                                  className="text-red-500 hover:text-red-400 hover:bg-red-500/10 w-8 h-8 rounded-lg"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <RequestLogger open={showLogger} onClose={() => setShowLogger(false)} />

      {/* Confirm Action Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.type === 'role' ? t('admin.table.roleTitle') : t('admin.table.deleteTitle')}
        message={confirmModal.type === 'role' 
          ? t('admin.table.confirmRoleChange', { name: confirmModal.user?.username, role: confirmModal.user?.role === 'admin' ? 'user' : 'admin' }) 
          : t('admin.table.confirmDelete', { name: confirmModal.user?.username })
        }
        onConfirm={onConfirmAction}
        onCancel={() => setConfirmModal({ isOpen: false, type: '', user: null })}
      />

      {/* Ban User Modal */}
      <BanUserModal
        isOpen={banModal.isOpen}
        user={banModal.user}
        onConfirm={onBanConfirm}
        onCancel={() => setBanModal({ isOpen: false, user: null })}
      />

      {/* Appeal Details Modal */}
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
