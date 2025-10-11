// FIX: Provided full content for missing App.tsx file.
import React, { useState, useEffect } from 'react';
import { useAppContext, saveTradeAction, deleteTradeAction, fetchMoreTradesAction } from './services/appState';
import Auth from './components/Auth';
import DataView from './components/DataView';
import TradesList from './components/TradesList';
import Modal from './components/ui/Modal';
import TradeForm from './components/TradeForm';
import { Trade } from './types';
import TradeDetail from './components/TradeDetail';
import AnalysisView from './components/AnalysisView';
import NotesView from './components/NotesView';

type View = 'journal' | 'dashboard' | 'analysis' | 'notes';

const App: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [activeView, setActiveView] = useState<View>('journal');

  const [isTradeFormOpen, setTradeFormOpen] = useState(false);
  const [tradeToEdit, setTradeToEdit] = useState<Trade | null>(null);

  const [isTradeDetailOpen, setTradeDetailOpen] = useState(false);
  const [tradeToView, setTradeToView] = useState<Trade | null>(null);

  useEffect(() => {
    if (state.session === null && !state.isGuest) {
      // User signed out, reset views
      setTradeFormOpen(false);
      setTradeDetailOpen(false);
      setTradeToEdit(null);
      setTradeToView(null);
    }
  }, [state.session, state.isGuest]);

  if (!state.session && !state.isGuest) {
    return <Auth />;
  }

  const handleAddTrade = () => {
    setTradeToEdit(null);
    setTradeFormOpen(true);
  };

  const handleEditTrade = (trade: Trade) => {
    setTradeToEdit(trade);
    setTradeFormOpen(true);
  };

  const handleViewTrade = (trade: Trade) => {
    setTradeToView(trade);
    setTradeDetailOpen(true);
  };

  const handleDeleteTrade = async (id: string) => {
    if (confirm('Are you sure you want to delete this trade?')) {
      await deleteTradeAction(dispatch, state, id);
      if (tradeToView?.id === id) {
        setTradeDetailOpen(false);
        setTradeToView(null);
      }
    }
  };

  const handleSaveTrade = async (tradeData: Omit<Trade, 'id' | 'userId'>, id?: string) => {
    await saveTradeAction(dispatch, state, tradeData, id);
    setTradeFormOpen(false);
    setTradeToEdit(null);
  };
  
  const handleLoadMore = () => {
    fetchMoreTradesAction(dispatch, state, 50); // Fetch 50 more
  };

  const NavButton: React.FC<{view: View, label: string}> = ({ view, label }) => (
    <button 
      onClick={() => setActiveView(view)}
      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeView === view ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="bg-gray-900 text-white min-h-screen">
      <header className="bg-gray-800/50 backdrop-blur-sm sticky top-0 z-40 border-b border-gray-700/50">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold">TradeJournal</h1>
                     <div className="hidden md:flex items-center gap-2">
                      <NavButton view="dashboard" label="Dashboard" />
                      <NavButton view="journal" label="Journal" />
                      <NavButton view="analysis" label="Analysis" />
                      <NavButton view="notes" label="Notes" />
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleAddTrade}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-500 transition-colors"
                    >
                        Add Trade
                    </button>
                     <button onClick={() => dispatch({ type: 'LOGOUT' })} className="text-sm text-gray-400 hover:text-white">
                        Logout
                    </button>
                </div>
            </div>
             <div className="md:hidden flex items-center gap-2 pb-3 justify-center">
              <NavButton view="dashboard" label="Dashboard" />
              <NavButton view="journal" label="Journal" />
              <NavButton view="analysis" label="Analysis" />
              <NavButton view="notes" label="Notes" />
            </div>
        </nav>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        {activeView === 'dashboard' && <DataView />}
        {activeView === 'journal' && (
          <TradesList
            onAddTrade={handleAddTrade}
            onEdit={handleEditTrade}
            onView={handleViewTrade}
            onDelete={handleDeleteTrade}
            onLoadMore={handleLoadMore}
            hasMore={state.hasMoreTrades}
            isFetchingMore={state.isFetchingMoreTrades}
          />
        )}
        {activeView === 'analysis' && <AnalysisView />}
        {activeView === 'notes' && <NotesView />}
      </main>

      <Modal isOpen={isTradeFormOpen} onClose={() => setTradeFormOpen(false)} title={tradeToEdit ? 'Edit Trade' : 'Add New Trade'} size="3xl">
        <TradeForm
            onSave={handleSaveTrade}
            onCancel={() => setTradeFormOpen(false)}
            tradeToEdit={tradeToEdit}
        />
      </Modal>

      <Modal isOpen={isTradeDetailOpen} onClose={() => setTradeDetailOpen(false)} title="Trade Details" size="4xl">
        {tradeToView && <TradeDetail trade={tradeToView} onEdit={handleEditTrade} onDelete={handleDeleteTrade} />}
      </Modal>
    </div>
  );
};

export default App;
