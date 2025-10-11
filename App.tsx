// FIX: Provided full content for missing App.tsx file.
import React, { useEffect } from 'react';
import { useAppContext } from './services/appState';
import Auth from './components/Auth';
import DataView from './components/DataView';
import { ICONS } from './constants';

const Toast: React.FC<{ message: string; type: 'success' | 'error' | 'info'; onDismiss: () => void }> = ({ message, type, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(onDismiss, 5000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    const baseClasses = "fixed bottom-5 right-5 flex items-center p-4 rounded-lg shadow-lg text-white max-w-sm z-[100]";
    const typeClasses = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        info: 'bg-blue-600',
    };

    return (
        <div className={`${baseClasses} ${typeClasses[type]}`}>
            <span className="flex-grow">{message}</span>
            <button onClick={onDismiss} className="ml-4 p-1 rounded-full hover:bg-black/20">
              <span className="w-5 h-5 block">{ICONS.x}</span>
            </button>
        </div>
    );
};


const App: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const { session, currentUser, isGuest, isLoading, toast } = state;
  const isLoggedIn = session && currentUser;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1A1D26] flex items-center justify-center">
        <div className="text-white text-xl">Loading Journal...</div>
      </div>
    );
  }

  return (
    <div className="bg-[#1A1D26] min-h-screen text-[#F0F0F0]">
        { (isLoggedIn || isGuest) ? <DataView /> : <Auth /> }
        {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => dispatch({ type: 'HIDE_TOAST' })} />}
    </div>
  );
};

export default App;
