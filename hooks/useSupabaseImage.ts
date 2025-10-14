import { useState, useEffect } from 'react';
import { getImageUrl } from '../services/storageService';

interface ImageState {
    url: string | null;
    error: boolean;
    isLoading: boolean;
}

/**
 * A hook to get a signed URL for a private image from Supabase Storage
 * using the centralized storageService.
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

        const fetchImageUrl = async () => {
            setImageState({ url: null, isLoading: true, error: false });
            const signedUrl = await getImageUrl(storagePath);
            if (signedUrl) {
                setImageState({ url: signedUrl, isLoading: false, error: false });
            } else {
                setImageState({ url: null, isLoading: false, error: true });
            }
        };

        fetchImageUrl();

    }, [storagePath]);

    return imageState;
};

export default useSupabaseImage;