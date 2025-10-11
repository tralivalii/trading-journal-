

import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
// FIX: Corrected module import path to be relative.
import { useAppContext } from '../services/appState';

interface SupabaseTransformOptions {
    transform: {
        width: number;
        height?: number;
        resize?: 'cover' | 'contain' | 'fill';
        quality?: number;
    }
}

const useImageBlobUrl = (
    imageKey: string | undefined | null,
    options?: SupabaseTransformOptions
): string | null => {
    const { state } = useAppContext();
    const { currentUser, isGuest } = state;
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!imageKey || !currentUser || isGuest) {
            setUrl(null);
            return;
        }

        let isMounted = true;
        
        const getSignedUrl = async () => {
            try {
                // The third argument to createSignedUrl is the options object,
                // which can include the 'transform' key for image processing.
                const { data, error } = await supabase
                    .storage
                    .from('screenshots')
                    .createSignedUrl(`${currentUser!.id}/${imageKey}`, 3600, options); // 3600 seconds = 1 hour
                
                if (error) {
                    throw error;
                }

                if (isMounted) {
                    setUrl(data.signedUrl);
                }
            } catch (error) {
                console.error("Error creating signed URL:", error);
                if (isMounted) {
                    setUrl(null); // Set to null on error
                }
            }
        };

        getSignedUrl();

        return () => {
            isMounted = false;
        };
    }, [imageKey, currentUser, isGuest, options]);

    return url;
};

export default useImageBlobUrl;