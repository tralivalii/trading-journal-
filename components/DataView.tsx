import React, { useState, useEffect } from 'react';
import { useAppContext } from '../services/appState';
import { supabase } from '../services/supabase';
// FIX: Import offlineService to handle data clearing on logout.
import * as offlineService from '../services/offlineService';
import TradesList from './TradesList';
import SettingsView from './SettingsView';
import Auth from './Auth';
import AnalysisView from './AnalysisView';
import NotesView from './NotesView';
import { ICONS } from '../constants';
import DropdownMenu, { DropdownMenuItem } from './ui/DropdownMenu';
import AccountForm from './AccountForm';
import { Account } from '../types';
import TradeForm from './TradeForm';
import TradeDetail from './TradeDetail';
import Modal from './ui/Modal';


type View = 'journal' | 'dashboard' | 'analysis' | 'notes' | 'settings';

const NavItem: React.FC<{
    label: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            isActive
                ? 'bg-[#1A1D26] text-white'
                : 'text-[#8A91A8] hover:bg-[#2A2F3B] hover:text-white'
        }`}
    >
        {label}
    </button>
);

const UserMenu: React.FC<{ onLogout: () => void, email?: string }> = ({ onLogout, email }) => (
    <DropdownMenu 
        trigger={
            <button className="flex items-center justify-center w-8 h-8 bg-gray-700 rounded-full hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
            </button>
        }
    >
        {email && (
            <div className="px-4 py-2 text-xs text-gray-400 border-b border-gray-700/50">
                <p>Signed in as</p>
                <p className="font-medium text-gray-200 truncate">{email}</p>
            </div>
        )}
        <DropdownMenuItem onClick={onLogout}>
            Logout
        </DropdownMenuItem>
    </DropdownMenu>
);

const FloatingActionButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <button
        onClick={onClick}
        className="fixed bottom-6 right-6 lg:hidden w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-transform transform hover:scale-105"
        aria-label="Add new trade"
    >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
    </button>
);

const DataView: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { currentUser, isGuest, userData } = state;
    const [currentView, setCurrentView] = useState<View>('journal');
    
    // --- Modal States ---
    const [isTradeFormOpen, setIsTradeFormOpen] = useState(false);
    const [tradeToEdit, setTradeToEdit] = useState<any | null>(null);
    const [isTradeDetailOpen, setIsTradeDetailOpen] = useState(false);
    const [tradeToView, setTradeToView] = useState<any | null>(null);
    const [isAccountFormOpen, setIsAccountFormOpen] = useState(false);
    const [accountToEdit, setAccountToEdit] = useState<any | null>(null);
    const accountMap = new Map(userData?.accounts.map(acc => [acc.id, acc]));

    const handleLogout = async () => {
        await supabase.auth.signOut();
        await offlineService.clearAllData();
        dispatch({ type: 'SET_USER_DATA', payload: null });
    };
    
    // --- Modal Handlers ---
    const handleOpenNewTrade = () => {
        setTradeToEdit(null);
        setIsTradeFormOpen(true);
    };

    const handleOpenEditTrade = (trade: any) => {
        setTradeToEdit(trade);
        setIsTradeDetailOpen(false);
        setIsTradeFormOpen(true);
    };

    const handleOpenViewTrade = (trade: any) => {
        setTradeToView(trade);
        setIsTradeDetailOpen(true);
    };
    
    const handleFormSave = () => {
        setIsTradeFormOpen(false);
        setTradeToEdit(null);
    };

    const handleFormCancel = () => {
        setIsTradeFormOpen(false);
        setTradeToEdit(null);
    };
    
    const renderView = () => {
        switch(currentView) {
            case 'journal':
                return <TradesList onNewTrade={handleOpenNewTrade} onEditTrade={handleOpenEditTrade} onViewTrade={handleOpenViewTrade} />;
            case 'dashboard':
                // Dashboard logic can be here or in its own component
                return <div>Dashboard View</div>;
            case 'analysis':
                return <AnalysisView />;
            case 'notes':
                return <NotesView />;
            case 'settings':
                return <SettingsView onOpenAccountForm={(acc) => { setAccountToEdit(acc); setIsAccountFormOpen(true); }} />;
            default:
                return <TradesList onNewTrade={handleOpenNewTrade} onEditTrade={handleOpenEditTrade} onViewTrade={handleOpenViewTrade} />;
        }
    }
    
    return (
        <div className="min-h-screen bg-[#1A1D26] text-white">
            <header className="bg-[#232733] border-b border-gray-700/50 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-4">
                            <h1 className="text-xl font-bold">Trading Journal</h1>
                            <nav className="hidden md:flex items-center space-x-1 bg-[#2A2F3B] p-1 rounded-lg">
                                <NavItem label="Journal" isActive={currentView === 'journal'} onClick={() => setCurrentView('journal')} />
                                <NavItem label="Analysis" isActive={currentView === 'analysis'} onClick={() => setCurrentView('analysis')} />
                                <NavItem label="Notes" isActive={currentView === 'notes'} onClick={() => setCurrentView('notes')} />
                                <NavItem label="Settings" isActive={currentView === 'settings'} onClick={() => setCurrentView('settings')} />
                            </nav>
                        </div>
                        <div className="flex items-center gap-4">
                            {!isGuest && (
                                <UserMenu onLogout={handleLogout} email={currentUser?.email} />
                            )}
                        </div>
                    </div>
                </div>
            </header>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {renderView()}
            </main>
            
            <FloatingActionButton onClick={handleOpenNewTrade} />

            {/* --- Modals --- */}
            <Modal isOpen={isTradeFormOpen} onClose={handleFormCancel} title={tradeToEdit ? "Edit Trade" : "Add New Trade"} size="4xl">
                <TradeForm tradeToEdit={tradeToEdit} onSave={handleFormSave} onCancel={handleFormCancel} />
            </Modal>
            
            {tradeToView && (
                 <Modal isOpen={isTradeDetailOpen} onClose={() => setIsTradeDetailOpen(false)} title="Trade Details" size="5xl">
                    <TradeDetail 
                        trade={tradeToView} 
                        account={accountMap.get(tradeToView.accountId)} 
                        onEdit={handleOpenEditTrade} 
                    />
                </Modal>
            )}

            <Modal isOpen={isAccountFormOpen} onClose={() => setIsAccountFormOpen(false)} title={accountToEdit ? "Edit Account" : "Add New Account"}>
                <AccountForm 
                    accountToEdit={accountToEdit}
                    onSave={() => setIsAccountFormOpen(false)}
                    onCancel={() => setIsAccountFormOpen(false)}
                />
            </Modal>
        </div>
    );
};

export default DataView;