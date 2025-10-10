
import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAppContext } from '../services/appState';

const useImageBlobUrl = (imageKey: string | undefined | null): string | null => {
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
                const { data, error } = await supabase
                    .storage
                    .from('screenshots')
                    .createSignedUrl(`${currentUser!.id}/${imageKey}`, 3600); // 3600 seconds = 1 hour expiration
                
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
    }, [imageKey, currentUser, isGuest]);

    return url;
};

export default useImageBlobUrl;
