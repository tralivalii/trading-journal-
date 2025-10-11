// FIX: Provided full content for missing databaseService.ts file.
import { supabase } from './supabase';
import { Trade, Account, Note, UserSettings } from '../types';

// Trades
export const getTrades = async (userId: string, page: number, pageSize: number) => {
    const { data, error, count } = await supabase
        .from('trades')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    return { data: data as Trade[], count: count ?? 0 };
};

export const saveTrade = async (trade: Partial<Trade>, userId: string, tradeId?: string) => {
    const tradeData = { ...trade, user_id: userId };
    if (tradeId) {
        const { data, error } = await supabase.from('trades').update(tradeData).eq('id', tradeId).select().single();
        if (error) throw error;
        return data as Trade;
    } else {
        const { data, error } = await supabase.from('trades').insert(tradeData).select().single();
        if (error) throw error;
        return data as Trade;
    }
};

export const deleteTrade = async (tradeId: string) => {
    const { error } = await supabase.from('trades').delete().eq('id', tradeId);
    if (error) throw error;
};

// Accounts
export const getAccounts = async (userId: string) => {
    const { data, error } = await supabase.from('accounts').select('*').eq('user_id', userId);
    if (error) throw error;
    return data as Account[];
};

// Notes
export const getNotes = async (userId: string, page: number, pageSize: number) => {
    const { data, error, count } = await supabase
        .from('notes')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    return { data: data as Note[], count: count ?? 0 };
};

export const saveNote = async (note: Partial<Note>, userId: string, noteId?: string) => {
    const noteData = { ...note, user_id: userId };
    if (noteId) {
        const { data, error } = await supabase.from('notes').update(noteData).eq('id', noteId).select().single();
        if (error) throw error;
        return data as Note;
    } else {
        const { data, error } = await supabase.from('notes').insert(noteData).select().single();
        if (error) throw error;
        return data as Note;
    }
};

export const deleteNote = async (noteId: string) => {
    const { error } = await supabase.from('notes').delete().eq('id', noteId);
    if (error) throw error;
};


// Settings
export const getSettings = async (userId: string) => {
    const { data, error } = await supabase.from('settings').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data as UserSettings | null;
};
