import { useState, useEffect } from 'react';
import { getImage, saveImage } from '../services/imageDB';

interface ImageState {
    url: string | null;
    error: boolean;
    isLoading: boolean;
}

const useImageBlobUrl = (imageUrl: string | undefined | null): ImageState => {
    const [imageState, setImageState] = useState<ImageState>({
        url: null,
        error: false,
        isLoading: true,
    });

    useEffect(() => {
        if (!imageUrl) {
            setImageState({ url: null, error: false, isLoading: false });
            return;
        }

        let isMounted = true;
        let objectUrlToRevoke: string | null = null;
        
        setImageState({ url: null, error: false, isLoading: true });

        const getUrl = async () => {
            try {
                // Handle custom idb protocol for Notes
                if (imageUrl.startsWith('idb://')) {
                    const imageKey = imageUrl.substring(6);
                    const file = await getImage(imageKey);
                    if (!file) throw new Error('Local image not found in IndexedDB');
                    if (isMounted) {
                        objectUrlToRevoke = URL.createObjectURL(file);
                        setImageState({ url: objectUrlToRevoke, error: false, isLoading: false });
                    }
                    return;
                }
                 // Handle guest/local-only images for Trades
                if (imageUrl.startsWith('local://')) {
                    const localFile = await getImage(imageUrl);
                    if (!localFile) throw new Error('Local image not found in cache.');
                    if (isMounted) {
                        objectUrlToRevoke = URL.createObjectURL(localFile);
                        setImageState({ url: objectUrlToRevoke, error: false, isLoading: false });
                    }
                    return;
                }

                // Handle public https URLs
                if (imageUrl.startsWith('https://') || imageUrl.startsWith('http://')) {
                    // Priority 1: Check cache
                    const cachedFile = await getImage(imageUrl);
                    if (isMounted && cachedFile) {
                        objectUrlToRevoke = URL.createObjectURL(cachedFile);
                        setImageState({ url: objectUrlToRevoke, error: false, isLoading: false });
                        return;
                    }

                    // Priority 2: Fetch from network
                    const response = await fetch(imageUrl);
                    if (!response.ok) throw new Error(`Network response not ok: ${response.statusText}`);
                    
                    const blob = await response.blob();
                    if (isMounted) {
                        const file = new File([blob], imageUrl.split('/').pop() || 'cached-image', { type: blob.type });
                        saveImage(imageUrl, file); // Cache in background
                        objectUrlToRevoke = URL.createObjectURL(file);
                        setImageState({ url: objectUrlToRevoke, error: false, isLoading: false });
                    }
                    return;
                }

                // If protocol is unknown or unsupported
                throw new Error(`Unsupported image URL protocol: ${imageUrl}`);

            } catch (err) {
                console.error(`Failed to load image from ${imageUrl}:`, err);
                if (isMounted) {
                    setImageState({ url: null, error: true, isLoading: false });
                }
            }
        };

        getUrl();

        return () => {
            isMounted = false;
            if (objectUrlToRevoke) {
                URL.revokeObjectURL(objectUrlToRevoke);
            }
        };
    }, [imageUrl]);

    return imageState;
};

export default useImageBlobUrl;