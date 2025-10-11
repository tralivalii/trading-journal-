import { useEffect, useState, useCallback } from 'react';
import { useAppContext } from '../services/appState';
import { getSyncQueue, clearSyncQueue } from '../services/offlineService';
import { supabase } from '../services/supabase';
// FIX: Changed import to be a relative path
import { convertToSnakeCase } from '../utils/caseConverter';

const SyncManager = () => {
  const { state, dispatch } = useAppContext();
  const { syncStatus, currentUser, isGuest } = state;
  const [isSyncing, setIsSyncing] = useState(false);

  const processSyncQueue = useCallback(async () => {
    if (isSyncing || isGuest || !currentUser) {
      return;
    }

    const queue = await getSyncQueue();
    if (queue.length === 0) {
      return;
    }

    setIsSyncing(true);
    dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });

    console.log(`Starting sync for ${queue.length} items...`);

    const sortedQueue = queue.sort((a, b) => a.timestamp - b.timestamp);
    let success = true;

    for (const item of sortedQueue) {
      try {
        const payload = convertToSnakeCase({ ...item.payload });
        
        switch (item.type) {
          case 'trade':
            if (item.action === 'create' || item.action === 'update') {
              const { error } = await supabase.from('trades').upsert({ ...payload, user_id: currentUser.id });
              if (error) throw error;
            } else if (item.action === 'delete') {
              const { error } = await supabase.from('trades').delete().eq('id', item.payload.id);
              if (error) throw error;
            }
            break;
          case 'account':
            if (item.action === 'create' || item.action === 'update') {
              const { error } = await supabase.from('accounts').upsert({ ...payload, user_id: currentUser.id });
              if (error) throw error;
            } else if (item.action === 'delete') {
              const { error } = await supabase.from('accounts').delete().eq('id', item.payload.id);
              if (error) throw error;
            }
            break;
          case 'note':
             if (item.action === 'create' || item.action === 'update') {
              const { error } = await supabase.from('notes').upsert({ ...payload, user_id: currentUser.id });
              if (error) throw error;
            } else if (item.action === 'delete') {
              const { error } = await supabase.from('notes').delete().eq('id', item.payload.id);
              if (error) throw error;
            }
            break;
           case 'settings':
             if (item.action === 'update') {
               const { error } = await supabase.from('user_settings').upsert({ user_id: currentUser.id, settings_data: item.payload });
               if (error) throw error;
             }
             break;
        }
      } catch (error) {
        console.error('Sync failed for item:', item, error);
        success = false;
        break; // Stop sync on first error to maintain order
      }
    }

    if (success) {
      await clearSyncQueue();
      dispatch({ type: 'SHOW_TOAST', payload: { message: 'Data synced with cloud.', type: 'success' } });
    } else {
      dispatch({ type: 'SHOW_TOAST', payload: { message: 'Sync failed. Your changes are still saved locally.', type: 'error' } });
    }

    setIsSyncing(false);
    // Only set back to 'online' if the browser is actually online
    if (navigator.onLine) {
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'online' });
    }

  }, [isSyncing, currentUser, isGuest, dispatch]);

  useEffect(() => {
    if (syncStatus === 'online') {
      processSyncQueue();
    }

    window.addEventListener('sync-request', processSyncQueue);
    return () => {
      window.removeEventListener('sync-request', processSyncQueue);
    };
  }, [syncStatus, processSyncQueue]);

  return null;
};

export default SyncManager;
