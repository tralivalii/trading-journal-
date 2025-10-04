import { useState, useEffect } from 'react';
import { getImage } from '../services/imageDB';

const useImageBlobUrl = (imageId: string | undefined | null): string | null => {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        // If there is no imageId, ensure no URL is set.
        if (!imageId) {
            setUrl(null);
            return;
        }

        // isMounted flag to prevent setting state on an unmounted component.
        let isMounted = true;
        
        getImage(imageId)
            .then(blob => {
                // Only proceed if the component is still mounted and a blob was found.
                if (isMounted && blob) {
                    const objectUrl = URL.createObjectURL(blob);
                    setUrl(objectUrl);
                } else if (isMounted) {
                    // If blob is not found, clear any existing URL.
                    setUrl(null);
                }
            })
            .catch(e => {
                if (isMounted) {
                    console.error(`Failed to load image with key ${imageId}`, e);
                    setUrl(null);
                }
            });

        return () => {
            // When the component unmounts or imageId changes, set isMounted to false.
            isMounted = false;
        };
    }, [imageId]);

    // A separate effect to handle the cleanup of the object URL.
    // This effect runs whenever the 'url' state changes.
    useEffect(() => {
        // The returned function is the cleanup function.
        // It will be executed when the component unmounts or before the effect runs again for a new URL.
        return () => {
            // If there's a URL, revoke it to free up memory.
            if (url) {
                URL.revokeObjectURL(url);
            }
        };
    }, [url]); // This effect depends on the 'url' state itself.

    return url;
};

export default useImageBlobUrl;
