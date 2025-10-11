// FIX: Provided full content for missing DataView.tsx file.
import React, { useState, useMemo } from 'react';
import { useAppContext, saveTradeAction, deleteTradeAction, fetchMoreTradesAction } from '../services/appState';
import { Trade } from '../types';
import TradesList from './TradesList';
import AnalysisView from './AnalysisView';
import NotesView from './NotesView';
import Modal from './ui/Modal';
import TradeForm from './TradeForm';
import TradeDetail from './TradeDetail';
import { calculateStats } from '../services/statisticsService';
import { ICONS } from '../constants';

type View = 'journal' | 'analysis' | 'notes';

const Header: React.FC<{ activeView: View; setActiveView: (view: View) => void }> = ({ activeView, setActiveView }) => {
    const { state, dispatch } = useAppContext();

    const NavButton: React.FC<{ view: View, label: string }> = ({ view, label }) => (
        <button
            onClick={() => setActiveView(view)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeView === view ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
        >
            {label}
        </button>
    );

    return (
        <header className="bg-[#232733] p-4 flex justify-between items-center border-b border-gray-700/50 sticky top-0 z-30">
            <div className="text-xl font-bold text-white">
                Trade Journal
            </div>
            <nav className="flex items-center gap-2 md:gap-4">
                <NavButton view="journal" label="Journal" />
                <NavButton view="analysis" label="Analysis" />
                <NavButton view="notes" label="Notes" />
            </nav>
            <button
                onClick={() => {
                    if (state.isGuest) {
                        dispatch({ type: 'LOGOUT' });
                    } else {
                         supabase.auth.signOut().then(() => {
                            dispatch({ type: 'LOGOUT' });
                         });
                    }
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-red-500 transition-colors text-sm"
            >
                {state.isGuest ? 'Exit Guest Mode' : 'Logout'}
            </button>
        </header>
    );
};

const StatCard: React.FC<{ label: string, value: string | number, color?: string }> = ({ label, value, color = 'text-white' }) => (
    <div className="bg-[#2A2F3B] p-4 rounded-lg flex-1 text-center border border-gray-700/50">
        <div className="text-sm text-[#8A91A8] uppercase tracking-wider">{label}</div>
        <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
);


const DataView: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { userData, hasMoreTrades, isFetchingMoreTrades } = state;
    const [activeView, setActiveView] = useState<View>('journal');
    
    const [isTradeFormModalOpen, setIsTradeFormModalOpen] = useState(false);
    const [isTradeDetailModalOpen, setIsTradeDetailModalOpen] = useState(false);
    const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

    const stats = useMemo(() => {
        if (!userData?.trades) return null;
        return calculateStats(userData.trades);
    }, [userData?.trades]);

    const handleSaveTrade = async (tradeData: Omit<Trade, 'id' | 'userId'>, id?: string) => {
        const isUpdate = !!id;
        try {
            await saveTradeAction(dispatch, state, isUpdate ? { ...tradeData, id } : tradeData, isUpdate);
            setIsTradeFormModalOpen(false);
            setSelectedTrade(null);
        } catch (error) {
            console.error("Failed to save trade:", error);
        }
    };

    const handleDeleteTrade = async (id: string) => {
        if (confirm('Are you sure you want to delete this trade?')) {
             try {
                await deleteTradeAction(dispatch, state, id);
                if (selectedTrade?.id === id) {
                    setIsTradeDetailModalOpen(false);
                    setSelectedTrade(null);
                }
            } catch (error) {
                console.error("Failed to delete trade:", error);
            }
        }
    };
    
    const handleAddTrade = () => {
        setSelectedTrade(null);
        setIsTradeFormModalOpen(true);
    };
    
    const handleEditTrade = (trade: Trade) => {
        setSelectedTrade(trade);
        setIsTradeDetailModalOpen(false);
        setIsTradeFormModalOpen(true);
    };

    const handleViewTrade = (trade: Trade) => {
        setSelectedTrade(trade);
        setIsTradeDetailModalOpen(true);
    };
    
    const handleLoadMoreTrades = () => {
        fetchMoreTradesAction(dispatch, state);
    }
    
    const renderContent = () => {
        switch(activeView) {
            case 'journal':
                return <TradesList 
                    onAddTrade={handleAddTrade}
                    onEdit={handleEditTrade}
                    onView={handleViewTrade}
                    onDelete={handleDeleteTrade}
                    onLoadMore={handleLoadMoreTrades}
                    hasMore={hasMoreTrades}
                    isFetchingMore={isFetchingMoreTrades}
                />;
            case 'analysis':
                return <AnalysisView />;
            case 'notes':
                return <NotesView />;
            default:
                return null;
        }
    };

    if (!userData || !stats) {
        return <div className="p-8">Loading data...</div>;
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Header activeView={activeView} setActiveView={setActiveView} />

            <main className="flex-grow p-4 md:p-8">
                {activeView === 'journal' && (
                     <div className="mb-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <StatCard label="Total Trades" value={stats.totalTrades} />
                        <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} color={stats.winRate >= 50 ? 'text-[#10B981]' : 'text-[#EF4444]'} />
                        <StatCard label="Net Profit" value={stats.netProfit.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })} color={stats.netProfit >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'} />
                        <StatCard label="Avg. R:R" value={stats.averageRR.toFixed(2)} />
                        <StatCard label="Total Wins" value={stats.wins} color="text-[#10B981]" />
                        <StatCard label="Total Losses" value={stats.losses} color="text-[#EF4444]" />
                    </div>
                )}
                
                <div className="relative">
                   {activeView === 'journal' && (
                        <button 
                            onClick={handleAddTrade}
                            className="fixed bottom-8 right-8 bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-500 transition-transform hover:scale-110 z-40"
                            aria-label="Add new trade"
                        >
                        <span className="w-6 h-6 block">{ICONS.plus}</span>
                        </button>
                   )}
                    {renderContent()}
                </div>

            </main>
            
            <Modal isOpen={isTradeFormModalOpen} onClose={() => setIsTradeFormModalOpen(false)} title={selectedTrade ? 'Edit Trade' : 'Add New Trade'}>
                <TradeForm 
                    onSave={handleSaveTrade}
                    onCancel={() => setIsTradeFormModalOpen(false)}
                    tradeToEdit={selectedTrade}
                />
            </Modal>
            
            <Modal isOpen={isTradeDetailModalOpen} onClose={() => setIsTradeDetailModalOpen(false)} title="Trade Details">
                {selectedTrade && <TradeDetail trade={selectedTrade} onEdit={handleEditTrade} onDelete={handleDeleteTrade} />}
            </Modal>
        </div>
    );
};

export default DataView;
