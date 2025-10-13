import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

interface ImageState {
    url: string | null;
    error: boolean;
    isLoading: boolean;
}

/**
 * A hook to get a signed URL for a private image from Supabase Storage.
 * @param storagePath The path to the file in the storage bucket.
 * @returns An object with the signed URL, loading state, and error state.
 */
const useSupabaseImage = (storagePath: string | undefined | null): ImageState => {
    const [imageState, setImageState] = useState<ImageState>({
        url: null,
        error: false,
        isLoading: true,
    });

    useEffect(() => {
        if (!storagePath) {
            setImageState({ url: null, isLoading: false, error: false });
            return;
        }

        const getSignedUrl = async () => {
            setImageState(prev => ({ ...prev, isLoading: true }));
            try {
                const { data, error } = await supabase.storage
                    .from('trade-attachments')
                    .createSignedUrl(storagePath, 60 * 5); // Signed URL valid for 5 minutes

                if (error) {
                    throw error;
                }

                setImageState({ url: data.signedUrl, isLoading: false, error: false });
            } catch (error) {
                console.error('Error creating signed URL:', error);
                setImageState({ url: null, isLoading: false, error: true });
            }
        };

        getSignedUrl();

        // Optional: Clean up the object URL when the component unmounts or the path changes
        return () => {
            if (imageState.url && imageState.url.startsWith('blob:')) {
                URL.revokeObjectURL(imageState.url);
            }
        };
    }, [storagePath]);

    return imageState;
};

export default useSupabaseImage;