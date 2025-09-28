// FIX: Added full content for App.tsx
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import useLocalStorage from './hooks/useLocalStorage';
import { Account, DefaultSettings, Trade, Stats, Result, User, UserData, Note } from './types';
import TradesList from './components/TradesList';
import Modal from './components/ui/Modal';
import TradeForm from './components/TradeForm';
import TradeDetail from './components/TradeDetail';
import DataView from './components/DataView';
import NotesView from './components/NotesView';
import NoteDetail from './components/NoteDetail';
import { calculateStats, filterTradesByPeriod } from './services/statisticsService';
import Auth from './components/Auth';
import * as db from './services/databaseService';


type View = 'journal' | 'dashboard' | 'data' | 'notes';
type Period = 'week' | 'month' | 'quarter' | 'all';

const StatCard: React.FC<{ label: string, value: string | number, className?: string }> = ({ label, value, className }) => (
    <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50 text-center">
        <p className="text-sm text-gray-400">{label}</p>
        <p className={`text-2xl font-bold ${className}`}>{value}</p>
    </div>
);

const Dashboard: React.FC<{ trades: Trade[]; accounts: Account[]; accountBalances: Map<string, number> }> = ({ trades, accounts, accountBalances }) => {
    const [period, setPeriod] = useState<Period>('month');
    
    const filteredTrades = useMemo(() => filterTradesByPeriod(trades, period), [trades, period]);
    const stats: Stats = useMemo(() => calculateStats(filteredTrades), [filteredTrades]);

    const formatCurrency = (amount: number, currency: string | undefined = 'USD') => amount.toLocaleString('en-US', { style: 'currency', currency: currency || 'USD' });
    const formatPercent = (value: number) => `${value.toFixed(2)}%`;
    const formatRR = (value: number) => `${value.toFixed(2)}R`;

    const mainCurrency = accounts.length > 0 ? (accounts[0].currency || 'USD') : 'USD';

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                <div className="flex flex-wrap items-center gap-2 mt-4">
                    {(['week', 'month', 'quarter', 'all'] as Period[]).map(p => (
                        <button 
                            key={p} 
                            onClick={() => setPeriod(p)}
                            className={`px-3 py-1 rounded-md text-xs capitalize transition-colors flex-shrink-0 ${period === p ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
                        >
                            {p === 'all' ? 'All Time' : `This ${p}`}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                 <StatCard label="Net Profit" value={formatCurrency(stats.netProfit, mainCurrency)} className={stats.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}/>
                 <StatCard label="Total Trades" value={stats.totalTrades} className="text-white" />
                 <StatCard label="Win Rate" value={formatPercent(stats.winRate)} className="text-cyan-400"/>
                 <StatCard label="Avg. R:R" value={formatRR(stats.averageRR)} className="text-purple-400"/>
                 <StatCard label="Total RR" value={formatRR(stats.totalRR)} className="text-indigo-400"/>
                 <StatCard label="W / L / B / M" value={`${stats.wins} / ${stats.losses} / ${stats.breakevens} / ${stats.missed}`} className="text-yellow-400"/>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-gray-800/50 rounded-lg border border-gray-700/50 p-4">
                     <h2 className="text-xl font-semibold text-white mb-4">Profit & Loss</h2>
                     <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-300">Total Profit</span>
                            <span className="font-semibold text-green-400">{formatCurrency(stats.profitSum, mainCurrency)}</span>
                        </div>
                         <div className="flex justify-between items-center">
                            <span className="text-gray-300">Total Loss</span>
                            <span className="font-semibold text-red-400">{formatCurrency(stats.lossSum, mainCurrency)}</span>
                        </div>
                        <div className="border-t border-gray-700 my-2"></div>
                         <div className="flex justify-between items-center">
                            <span className="text-lg font-bold text-white">Net Profit</span>
                            <span className={`text-lg font-bold ${stats.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(stats.netProfit, mainCurrency)}</span>
                        </div>
                     </div>
                </div>
                 <div className="lg:col-span-2 bg-gray-800/50 rounded-lg border border-gray-700/50 p-4">
                     <h2 className="text-xl font-semibold text-white mb-4">Account Balances</h2>
                     <div className="space-y-2">
                        {accounts.map(acc => (
                            <div key={acc.id} className="grid grid-cols-3 items-center text-sm">
                                <span className="font-semibold">{acc.name}</span>
                                <span className="text-gray-400">Initial: {formatCurrency(acc.initialBalance, acc.currency)}</span>
                                <span className="text-lg font-bold text-right text-cyan-400">{formatCurrency(accountBalances.get(acc.id) ?? 0, acc.currency)}</span>
                            </div>
                        ))}
                        {accounts.length === 0 && <p className="text-center text-gray-500 py-4">No accounts created yet.</p>}
                     </div>
                </div>
            </div>
        </div>
    );
}

function App() {
  const [currentUser, setCurrentUser] = useLocalStorage<User | null>('trading-journal-user', null);
  const [users, setUsers] = useLocalStorage<User[]>('trading-journal-users', []);

  // State is now managed locally with useState
  const [trades, setTrades] = useState<Trade[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [pairs, setPairs] = useState<string[]>([]);
  const [setups, setSetups] = useState<string[]>([]);
  const [risks, setRisks] = useState<number[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [defaultSettings, setDefaultSettings] = useState<DefaultSettings>({ accountId: '', pair: '', setup: '', risk: 1 });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isFormModalOpen, setFormModalOpen] = useState(false);
  const [isDetailModalOpen, setDetailModalOpen] = useState(false);
  const [isDeleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);
  const [isDeleteTradeModalOpen, setDeleteTradeModalOpen] = useState(false);
  const [tradeIdToDelete, setTradeIdToDelete] = useState<string | null>(null);
  const [tradeToEdit, setTradeToEdit] = useState<Trade | null>(null);
  const [tradeToView, setTradeToView] = useState<Trade | null>(null);
  const [activeView, setActiveView] = useState<View>('journal');
  const [isLogoutConfirmModalOpen, setLogoutConfirmModalOpen] = useState(false);
  
  // Note Modal State
  const [isNoteModalOpen, setNoteModalOpen] = useState(false);
  const [isNoteEditMode, setNoteEditMode] = useState(false);
  const [noteToViewOrEdit, setNoteToViewOrEdit] = useState<Note | null>(null);
  const [isDeleteNoteModalOpen, setDeleteNoteModalOpen] = useState(false);
  const [noteIdToDelete, setNoteIdToDelete] = useState<string | null>(null);

  // Fetch data from DB on user login
  useEffect(() => {
    if (currentUser) {
      setIsLoading(true);
      db.getUserData(currentUser.email).then(data => {
        setTrades(data.trades);
        setAccounts(data.accounts);
        setPairs(data.pairs);
        setSetups(data.setups);
        setRisks(data.risks);
        setNotes(data.notes || []); // Handle legacy users without notes
        setDefaultSettings(data.defaultSettings);
        setIsLoading(false);
      });
    } else {
      // Clear data on logout to prevent flash of old content
      setTrades([]);
      setAccounts([]);
      setPairs([]);
      setSetups([]);
      setRisks([]);
      setNotes([]);
      setDefaultSettings({ accountId: '', pair: '', setup: '', risk: 1 });
      setIsLoading(false);
    }
  }, [currentUser]);

  // Generic function to save the entire user data state to the DB
  const saveData = useCallback((data: Partial<UserData>) => {
    if (currentUser) {
      const fullData: UserData = {
        trades: data.trades !== undefined ? data.trades : trades,
        accounts: data.accounts !== undefined ? data.accounts : accounts,
        pairs: data.pairs !== undefined ? data.pairs : pairs,
        setups: data.setups !== undefined ? data.setups : setups,
        risks: data.risks !== undefined ? data.risks : risks,
        defaultSettings: data.defaultSettings !== undefined ? data.defaultSettings : defaultSettings,
        notes: data.notes !== undefined ? data.notes : notes,
      };
      db.saveUserData(currentUser.email, fullData);
    }
  }, [currentUser, trades, accounts, pairs, setups, risks, defaultSettings, notes]);

  // Create wrapper functions for state setters that also save to DB
  const createSetter = <T,>(setter: React.Dispatch<React.SetStateAction<T>>, state: T, key: keyof UserData) => 
    (newValue: React.SetStateAction<T>) => {
        const updatedValue = newValue instanceof Function ? newValue(state) : newValue;
        setter(updatedValue);
        saveData({ [key]: updatedValue });
  };
  
  const setTradesAndSave = createSetter(setTrades, trades, 'trades');
  const setAccountsAndSave = createSetter(setAccounts, accounts, 'accounts');
  const setPairsAndSave = createSetter(setPairs, pairs, 'pairs');
  const setSetupsAndSave = createSetter(setSetups, setups, 'setups');
  const setRisksAndSave = createSetter(setRisks, risks, 'risks');
  const setDefaultSettingsAndSave = createSetter(setDefaultSettings, defaultSettings, 'defaultSettings');
  const setNotesAndSave = createSetter(setNotes, notes, 'notes');

  const accountBalances = useMemo(() => {
    const balances = new Map<string, number>();
    accounts.forEach(acc => {
      const accountTrades = trades.filter(t => t.accountId === acc.id);
      const netPnl = accountTrades.reduce((sum, trade) => sum + Number(trade.pnl), 0);
      balances.set(acc.id, acc.initialBalance + netPnl);
    });
    return balances;
  }, [trades, accounts]);

  const handleAddTrade = () => {
    setTradeToEdit(null);
    setFormModalOpen(true);
  };

  const handleEditTrade = (trade: Trade) => {
    setTradeToEdit(trade);
    setFormModalOpen(true);
  };

  const handleViewTrade = (trade: Trade) => {
    setTradeToView(trade);
    setDetailModalOpen(true);
  }

  const handleDeleteTrade = (id: string) => {
    setTradeIdToDelete(id);
    setDeleteTradeModalOpen(true);
  };

  const handleConfirmDeleteTrade = () => {
    if (tradeIdToDelete) {
        setTradesAndSave(prev => prev.filter(trade => trade.id !== tradeIdToDelete));
    }
    setDeleteTradeModalOpen(false);
    setTradeIdToDelete(null);
  };

  const handleUpdateResult = (tradeId: string, newResult: Result) => {
    setTradesAndSave(prevTrades => {
      const tradeIndex = prevTrades.findIndex(t => t.id === tradeId);
      if (tradeIndex === -1) return prevTrades;

      const originalTrade = prevTrades[tradeIndex];
      let newPnl = 0;
      if (newResult === Result.Win) newPnl = originalTrade.riskAmount * originalTrade.rr;
      else if (newResult === Result.Loss) newPnl = -originalTrade.riskAmount;
      
      const updatedTrade = { ...originalTrade, result: newResult, pnl: newPnl - (originalTrade.commission || 0) };
      const newTrades = [...prevTrades];
      newTrades[tradeIndex] = updatedTrade;
      return newTrades;
    });
  };

  const handleSaveTrade = (tradeDataFromForm: Trade) => {
    const account = accounts.find(a => a.id === tradeDataFromForm.accountId);
    if (!account) return alert("Account not found!");

    const accountTrades = trades.filter(t => t.accountId === account.id && t.id !== tradeDataFromForm.id);
    const accountPnl = accountTrades.reduce((sum, trade) => sum + trade.pnl, 0);
    const currentBalance = account.initialBalance + accountPnl;
    
    const riskAmount = currentBalance * (tradeDataFromForm.risk / 100);
    const commission = tradeDataFromForm.commission || 0;
    let pnl = 0;
    if (tradeDataFromForm.result === Result.Win) pnl = riskAmount * tradeDataFromForm.rr;
    else if (tradeDataFromForm.result === Result.Loss) pnl = -riskAmount;

    const finalTrade: Trade = { ...tradeDataFromForm, id: tradeDataFromForm.id || crypto.randomUUID(), riskAmount, pnl: pnl - commission, commission };

    setTradesAndSave(prev => {
      const existingIndex = prev.findIndex(t => t.id === finalTrade.id);
      if (existingIndex > -1) {
        const newTrades = [...prev];
        newTrades[existingIndex] = finalTrade;
        return newTrades;
      }
      return [...prev, finalTrade];
    });
    setFormModalOpen(false);
    setTradeToEdit(null);
  };
  
  // Note Handlers
  const handleAddNote = (content: string) => {
      const newNote: Note = {
          id: crypto.randomUUID(),
          date: new Date().toISOString().split('T')[0],
          content,
      };
      setNotesAndSave(prev => [newNote, ...prev].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  };
  
  const handleViewNote = (note: Note) => {
      setNoteToViewOrEdit(note);
      setNoteEditMode(false);
      setNoteModalOpen(true);
  };
  
  const handleUpdateNote = (noteId: string, content: string) => {
      setNotesAndSave(prev => prev.map(n => n.id === noteId ? { ...n, content } : n));
      setNoteModalOpen(false);
      setNoteToViewOrEdit(null);
      setNoteEditMode(false);
  };
  
  const handleDeleteNoteRequest = (id: string) => {
      setNoteIdToDelete(id);
      setNoteModalOpen(false); // Close the detail modal first
      setDeleteNoteModalOpen(true);
  };
  
  const handleConfirmDeleteNote = () => {
      if (noteIdToDelete) {
          setNotesAndSave(prev => prev.filter(n => n.id !== noteIdToDelete));
      }
      setDeleteNoteModalOpen(false);
      setNoteIdToDelete(null);
      setNoteToViewOrEdit(null);
  };


  const handleLogout = () => {
    setLogoutConfirmModalOpen(true);
  };

  const handleConfirmLogout = () => {
    setCurrentUser(null);
    setLogoutConfirmModalOpen(false);
  };
  
  const handleDeleteUserAccount = async () => {
    if (!currentUser) return;
    await db.deleteUserData(currentUser.email);
    setUsers(prevUsers => prevUsers.filter(user => user.email !== currentUser.email));
    setCurrentUser(null);
    setDeleteConfirmModalOpen(false);
  };

  const NavItem: React.FC<{view: View, label: string}> = ({view, label}) => (
      <button onClick={() => setActiveView(view)} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeView === view ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}>
        {label}
      </button>
  );

  if (!currentUser) {
    return <Auth onAuthSuccess={setCurrentUser} users={users} setUsers={setUsers} />;
  }

  if (isLoading) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
            <div className="text-xl animate-pulse">Loading Your Journal...</div>
        </div>
    );
  }

  return (
    <div className="bg-gray-900 text-gray-100 min-h-screen font-sans">
      <div className="container mx-auto p-4 md:p-8">
        <header className="flex justify-between items-center mb-8 flex-wrap gap-4">
            <div className="flex items-center gap-4 w-full justify-center md:w-auto md:justify-start">
                <NavItem view="journal" label="Journal" />
                <NavItem view="dashboard" label="Dashboard" />
                <NavItem view="notes" label="Notes" />
                <NavItem view="data" label="Data" />
            </div>
            <div className="flex items-center gap-4 w-full justify-between md:w-auto mt-4 md:mt-0">
                <button onClick={handleAddTrade} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors text-sm font-medium">
                    Add New Trade
                </button>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400 hidden sm:inline">{currentUser.email}</span>
                    <button onClick={handleLogout} className="px-3 py-2 bg-gray-700 text-white rounded-md hover:bg-red-600 transition-colors text-sm font-medium">
                        Logout
                    </button>
                </div>
            </div>
        </header>

        <main>
          {activeView === 'journal' && <TradesList trades={trades} accounts={accounts} onEdit={handleEditTrade} onView={handleViewTrade} onDelete={handleDeleteTrade} onUpdateResult={handleUpdateResult} />}
          {activeView === 'dashboard' && <Dashboard trades={trades} accounts={accounts} accountBalances={accountBalances} />}
          {activeView === 'notes' && <NotesView notes={notes} onAddNote={handleAddNote} onViewNote={handleViewNote} />}
          {activeView === 'data' && <DataView 
              accounts={accounts} setAccounts={setAccountsAndSave}
              pairs={pairs} setPairs={setPairsAndSave}
              setups={setups} setSetups={setSetupsAndSave}
              risks={risks} setRisks={setRisksAndSave}
              defaultSettings={defaultSettings} setDefaultSettings={setDefaultSettingsAndSave}
              accountBalances={accountBalances}
              setTrades={setTradesAndSave}
              onInitiateDeleteAccount={() => setDeleteConfirmModalOpen(true)}
            />
          }
        </main>
      </div>

      <Modal isOpen={isFormModalOpen} onClose={() => setFormModalOpen(false)} title={tradeToEdit ? 'Edit Trade' : 'Add New Trade'}>
        <TradeForm onSave={handleSaveTrade} onCancel={() => setFormModalOpen(false)} tradeToEdit={tradeToEdit} accounts={accounts} pairs={pairs} setups={setups} risks={risks} defaultSettings={defaultSettings} />
      </Modal>
      
      <Modal isOpen={isDetailModalOpen} onClose={() => setDetailModalOpen(false)} title="Trade Details">
        {tradeToView && <TradeDetail trade={tradeToView} account={accounts.find(a => a.id === tradeToView.accountId)} />}
      </Modal>

      <Modal isOpen={isDeleteConfirmModalOpen} onClose={() => setDeleteConfirmModalOpen(false)} title="Confirm Account Deletion">
        <div className="text-center">
            <p className="text-gray-300 mb-6">Are you sure you want to permanently delete your account and all of your data? This action cannot be undone.</p>
            <div className="flex justify-center gap-4">
                <button onClick={() => setDeleteConfirmModalOpen(false)} className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors">Cancel</button>
                <button onClick={handleDeleteUserAccount} className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">Yes, Delete My Account</button>
            </div>
        </div>
      </Modal>

      <Modal isOpen={isDeleteTradeModalOpen} onClose={() => setDeleteTradeModalOpen(false)} title="Confirm Trade Deletion">
        <div className="text-center">
            <p className="text-gray-300 mb-6">Are you sure you want to permanently delete this trade? This action cannot be undone.</p>
            <div className="flex justify-center gap-4">
                <button onClick={() => setDeleteTradeModalOpen(false)} className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors">Cancel</button>
                <button onClick={handleConfirmDeleteTrade} className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">Yes, Delete Trade</button>
            </div>
        </div>
      </Modal>
      
      <Modal isOpen={isLogoutConfirmModalOpen} onClose={() => setLogoutConfirmModalOpen(false)} title="Confirm Logout">
        <div className="text-center">
            <p className="text-gray-300 mb-6">Are you sure you want to log out?</p>
            <div className="flex justify-center gap-4">
                <button onClick={() => setLogoutConfirmModalOpen(false)} className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors">Cancel</button>
                <button onClick={handleConfirmLogout} className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">Logout</button>
            </div>
        </div>
      </Modal>

      <Modal isOpen={isNoteModalOpen} onClose={() => setNoteModalOpen(false)} title={noteToViewOrEdit ? new Date(noteToViewOrEdit.date).toLocaleDateString() : 'Note'}>
        {noteToViewOrEdit && <NoteDetail 
            note={noteToViewOrEdit}
            isEditMode={isNoteEditMode}
            onSetEditMode={setNoteEditMode}
            onUpdate={handleUpdateNote}
            onDelete={handleDeleteNoteRequest}
        />}
      </Modal>
      
      <Modal isOpen={isDeleteNoteModalOpen} onClose={() => setDeleteNoteModalOpen(false)} title="Confirm Note Deletion">
        <div className="text-center">
            <p className="text-gray-300 mb-6">Are you sure you want to permanently delete this note?</p>
            <div className="flex justify-center gap-4">
                <button onClick={() => setDeleteNoteModalOpen(false)} className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors">Cancel</button>
                <button onClick={handleConfirmDeleteNote} className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">Yes, Delete Note</button>
            </div>
        </div>
      </Modal>

    </div>
  );
}

export default App;