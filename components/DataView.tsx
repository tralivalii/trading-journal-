
import React, { useState } from 'react';
import { useAppContext, saveTradeAction, deleteTradeAction, fetchMoreTradesAction } from '../services/appState';
import { supabase } from '../services/supabase';
import { ICONS } from '../constants';
import TradesList from './TradesList';
import AnalysisView from './AnalysisView';
import NotesView from './NotesView';
import SettingsView from './SettingsView';
import TradeForm from './TradeForm';
import TradeDetail from './TradeDetail';
import Modal from './ui/Modal';
import { Trade } from '../types';

type View = 'journal' | 'analysis' | 'notes' | 'settings';

const NavItem: React.FC<{
    label: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        isActive
            ? 'bg-blue-600 text-white'
            : 'text-gray-300 hover:bg-gray-700 hover:text-white'
        }`}
    >
        {label}
    </button>
);

const DataView: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { currentUser, isGuest, userData } = state;
    const [activeView, setActiveView] = useState<View>('journal');
    const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
    const [tradeToEdit, setTradeToEdit] = useState<Trade | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [tradeToView, setTradeToView] = useState<Trade | null>(null);

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            dispatch({ type: 'SHOW_TOAST', payload: { message: 'Error logging out.', type: 'error' } });
        } else {
            dispatch({ type: 'LOGOUT' });
        }
    };
    
    const handleSaveTrade = async (tradeData: Omit<Trade, 'id' | 'userId'>, id?: string) => {
        try {
            await saveTradeAction(dispatch, state, tradeData, !!id);
            setIsTradeModalOpen(false);
            setTradeToEdit(null);
        } catch (error) {
            // Error is handled in action
        }
    };

    const handleEditTrade = (trade: Trade) => {
        setTradeToEdit(trade);
        setIsDetailModalOpen(false);
        setIsTradeModalOpen(true);
    };

    const handleDeleteTrade = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this trade?')) {
            await deleteTradeAction(dispatch, state, id);
            setIsDetailModalOpen(false);
        }
    };
    
    const handleViewTrade = (trade: Trade) => {
        setTradeToView(trade);
        setIsDetailModalOpen(true);
    };

    const handleAddTradeClick = () => {
        setTradeToEdit(null);
        setIsTradeModalOpen(true);
    };
    
    const handleLoadMoreTrades = () => {
        fetchMoreTradesAction(dispatch, state);
    }
    
    const renderActiveView = () => {
        switch(activeView) {
            case 'journal':
                return <TradesList 
                    onAddTrade={handleAddTradeClick}
                    onEdit={handleEditTrade}
                    onView={handleViewTrade}
                    onDelete={handleDeleteTrade}
                    onLoadMore={handleLoadMoreTrades}
                    hasMore={userData?.hasMoreTrades || false}
                    isFetchingMore={userData?.isFetchingMoreTrades || false}
                />;
            case 'analysis':
                return <AnalysisView />;
            case 'notes':
                return <NotesView />;
            case 'settings':
                return <SettingsView />;
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-[#1A1D26]">
            <header className="bg-[#232733] border-b border-gray-700/50 sticky top-0 z-40">
                <div className="container mx-auto px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-bold text-white">TradeJournal</h1>
                        <nav className="hidden md:flex items-center gap-2">
                            <NavItem label="Journal" isActive={activeView === 'journal'} onClick={() => setActiveView('journal')} />
                            <NavItem label="Analysis" isActive={activeView === 'analysis'} onClick={() => setActiveView('analysis')} />
                            <NavItem label="Notes" isActive={activeView === 'notes'} onClick={() => setActiveView('notes')} />
                            <NavItem label="Settings" isActive={activeView === 'settings'} onClick={() => setActiveView('settings')} />
                        </nav>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={handleAddTradeClick} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors text-sm">
                            <span className="w-5 h-5">{ICONS.plus}</span>
                            <span className="hidden sm:inline">New Trade</span>
                        </button>
                        <div className="text-right text-sm">
                            <p className="text-white truncate max-w-[150px]">{ isGuest ? "Guest Mode" : currentUser?.email}</p>
                            <button onClick={handleLogout} className="text-blue-400 hover:underline">
                                {isGuest ? "Exit Guest Mode" : "Logout"}
                            </button>
                        </div>
                    </div>
                </div>
            </header>
            <main className="container mx-auto p-4 md:p-6">
                {renderActiveView()}
            </main>

            <Modal
                isOpen={isTradeModalOpen}
                onClose={() => setIsTradeModalOpen(false)}
                title={tradeToEdit ? 'Edit Trade' : 'Add New Trade'}
                size="4xl"
            >
                <TradeForm
                    onSave={handleSaveTrade}
                    onCancel={() => setIsTradeModalOpen(false)}
                    tradeToEdit={tradeToEdit}
                />
            </Modal>
             <Modal
                isOpen={isDetailModalOpen && !!tradeToView}
                onClose={() => setIsDetailModalOpen(false)}
                title="Trade Details"
                size="4xl"
            >
                {tradeToView && (
                    <TradeDetail
                        trade={tradeToView}
                        onEdit={handleEditTrade}
                        onDelete={handleDeleteTrade}
                    />
                )}
            </Modal>
        </div>
    );
};

export default DataView;
