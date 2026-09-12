import React, { useEffect, useMemo, useState } from 'react';
import { AppIcon } from '../AppIcon';

const imageUrl = (value) => !value ? '' : /^(https?:|blob:|data:)/.test(value) ? value : `${import.meta.env.BASE_URL}${value}`;

export function ImageReplaceField({ currentImage, file, onChange }) {
    const [error, setError] = useState('');
    const preview = useMemo(() => file ? URL.createObjectURL(file) : '', [file]);
    useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

    const select = (selected) => {
        setError('');
        if (!selected) return;
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(selected.type)) return setError('Use a genuine PNG, JPEG, or WebP image.');
        if (selected.size > 12 * 1024 * 1024) return setError('Image must be 12 MB or smaller.');
        onChange(selected);
    };

    return <div className="studio-image-field">
        <div className="studio-image-previews">
            <figure><figcaption>Current</figcaption>{currentImage ? <img src={imageUrl(currentImage)} alt="Current screenshot" /> : <div className="image-placeholder">No image yet</div>}</figure>
            <figure className={preview ? 'has-new-image' : ''}><figcaption>{currentImage ? 'Replacement' : 'New image'}</figcaption>{preview ? <img src={preview} alt="New screenshot preview" /> : <div className="image-placeholder"><AppIcon name="ImagePlus" /><span>Choose a file to preview</span></div>}</figure>
        </div>
        <label className="image-upload-button"><AppIcon name="UploadCloud" size={16} /><span>{currentImage ? 'Replace screenshot' : 'Choose screenshot'}</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => select(event.target.files?.[0])} /></label>
        <p className="field-hint">PNG, JPEG or WebP · maximum 12 MB. The old image is removed only after the new version publishes successfully.</p>
        {error && <p className="field-error">{error}</p>}
    </div>;
}
