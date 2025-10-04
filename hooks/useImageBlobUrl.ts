import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAppContext } from '../services/appState';

const useImageBlobUrl = (imageKey: string | undefined | null): string | null => {
    const { state } = useAppContext();
    const { currentUser } = state;
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!imageKey || !currentUser) {
            setUrl(null);
            return;
        }

        let isMounted = true;
        
        const getUrl = () => {
            const { data } = supabase
                .storage
                .from('screenshots')
                .getPublicUrl(`${currentUser.id}/${imageKey}`);
            
            if (isMounted) {
                setUrl(data.publicUrl);
            }
        };

        getUrl();

        return () => {
            isMounted = false;
        };
    }, [imageKey, currentUser]);

    return url;
};

export default useImageBlobUrl;
