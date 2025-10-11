
import React, { useState, useEffect } from 'react';
import { useAppContext } from './services/appState';
import { supabase } from './services/supabase';
import TradesList from './components/TradesList';
import DataView from './components/DataView';
import Auth from './components/Auth';
import Skeleton from './components/ui/Skeleton';
import AnalysisView from './components/AnalysisView';
import NotesView from './components/NotesView';

type View = 'trades' | 'analysis' | 'notes' | 'settings';

const NavItem: React.FC<{
    label: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            isActive
                ? 'bg-gray-900 text-white'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
        }`}
    >
        {label}
    </button>
);

const App: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { session, isLoading, isGuest, userData, toast, syncStatus } = state;
    const [currentView, setCurrentView] = useState<View>('trades');
    
    // Auto-dismiss toast
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => {
                dispatch({ type: 'HIDE_TOAST' });
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [toast, dispatch]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };
    
    const handleInitiateDeleteAccount = () => {
        if (confirm("Are you sure you want to permanently delete your account and all data? This cannot be undone.")) {
            // In a real app, this would call a Supabase Edge Function to delete user data
            // and then sign out. For now, we'll just sign out.
            console.log("Initiating account deletion...");
            handleLogout();
        }
    }

    if (isLoading) {
        return (
            <div className="bg-gray-900 min-h-screen flex items-center justify-center">
                <Skeleton className="w-64 h-32" />
            </div>
        );
    }
    
    if (!session && !isGuest) {
        return <Auth />;
    }

    if (!userData) {
         return (
            <div className="bg-gray-900 min-h-screen flex items-center justify-center text-white">
                <p>Loading user data...</p>
                <svg className="animate-spin ml-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#1A1D26] text-white">
            <header className="bg-[#232733] border-b border-gray-700/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-4">
                            <h1 className="text-xl font-bold">Trade Journal</h1>
                            <nav className="hidden md:flex items-center space-x-2">
                                <NavItem label="Trades" isActive={currentView === 'trades'} onClick={() => setCurrentView('trades')} />
                                <NavItem label="Analysis" isActive={currentView === 'analysis'} onClick={() => setCurrentView('analysis')} />
                                <NavItem label="Notes" isActive={currentView === 'notes'} onClick={() => setCurrentView('notes')} />
                                <NavItem label="Settings" isActive={currentView === 'settings'} onClick={() => setCurrentView('settings')} />
                            </nav>
                        </div>
                        <div className="flex items-center gap-4">
                            {!isGuest && (
                                <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-white">
                                    Sign Out
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {currentView === 'trades' && <TradesList />}
                {currentView === 'analysis' && <AnalysisView />}
                {currentView === 'notes' && <NotesView />}
                {currentView === 'settings' && <DataView onInitiateDeleteAccount={handleInitiateDeleteAccount} />}
            </main>
            
            {toast && (
                <div className={`fixed bottom-5 right-5 px-6 py-3 rounded-lg shadow-lg text-white ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                    {toast.message}
                </div>
            )}
            
            {syncStatus !== 'online' && !isGuest && (
                <div className="fixed bottom-5 left-5 px-4 py-2 rounded-lg shadow-lg bg-yellow-600 text-black text-sm font-semibold">
                    {syncStatus === 'offline' ? 'Offline Mode' : 'Syncing...'}
                </div>
            )}
        </div>
    );
};

export default App;
