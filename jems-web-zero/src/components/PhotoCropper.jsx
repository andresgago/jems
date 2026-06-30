import { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

async function getCroppedBlob(imageSrc, pixelCrop) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });
  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y,
    pixelCrop.width, pixelCrop.height,
    0, 0,
    pixelCrop.width, pixelCrop.height,
  );
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
}

/**
 * PhotoCropper — Browse → interactive crop → confirm.
 * Props:
 *   onCrop(blob|null)  called when user confirms crop or resets
 *   currentPhoto       URL of the existing saved photo (shown before browsing)
 */
export default function PhotoCropper({ onCrop, currentPhoto }) {
  const fileRef = useRef(null);

  // raw data-URL of the selected file
  const [src, setSrc] = useState(null);
  // crop state fed to react-easy-crop
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  // pixel crop area returned by onCropComplete
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  // confirmed blob preview URL
  const [preview, setPreview] = useState(null);
  const [cropping, setCropping] = useState(false);

  const onFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSrc(reader.result);
      setPreview(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      onCrop(null); // clear previous selection while re-cropping
    };
    reader.readAsDataURL(file);
    // reset input so the same file can be re-selected
    e.target.value = '';
  };

  const onCropComplete = useCallback((_, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleCrop = async () => {
    if (!croppedAreaPixels) return;
    setCropping(true);
    try {
      const blob = await getCroppedBlob(src, croppedAreaPixels);
      const url = URL.createObjectURL(blob);
      setPreview(url);
      setSrc(null);
      onCrop(blob);
    } finally {
      setCropping(false);
    }
  };

  const handleReset = () => {
    setSrc(null);
    setPreview(null);
    setCroppedAreaPixels(null);
    setZoom(1);
    onCrop(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  // ── confirmed preview ──────────────────────────────────────────────────────
  if (preview) {
    return (
      <div>
        <div className="mb-2">
          <img
            src={preview}
            alt="Cropped preview"
            style={{ maxWidth: 200, maxHeight: 150, objectFit: 'contain', borderRadius: 4, border: '1px solid #dee2e6' }}
          />
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setPreview(null); setSrc(null); fileRef.current?.click(); }}>
            <i className="bi bi-folder2-open me-1" />Browse
          </button>
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={handleReset}>
            <i className="bi bi-x-circle me-1" />Reset
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="d-none" onChange={onFileChange} />
      </div>
    );
  }

  // ── active cropper ────────────────────────────────────────────────────────
  if (src) {
    return (
      <div>
        <div style={{ position: 'relative', width: '100%', height: 260, background: '#333', borderRadius: 6, overflow: 'hidden' }}>
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <div className="d-flex gap-2 mt-2 align-items-center">
          <button type="button" className="btn btn-sm btn-success" onClick={handleCrop} disabled={cropping}>
            <i className="bi bi-scissors me-1" />{cropping ? 'Cropping…' : 'Crop'}
          </button>
          <button type="button" className="btn btn-sm btn-warning" onClick={() => { setCrop({ x: 0, y: 0 }); setZoom(1); }}>
            <i className="bi bi-arrow-counterclockwise me-1" />Reset
          </button>
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={handleReset}>
            <i className="bi bi-x-circle me-1" />Cancel
          </button>
          <div className="ms-auto d-flex align-items-center gap-1">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(1)))}>
              <i className="bi bi-dash" />
            </button>
            <span className="small text-muted" style={{ minWidth: 36, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(1)))}>
              <i className="bi bi-plus" />
            </button>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="d-none" onChange={onFileChange} />
      </div>
    );
  }

  // ── idle (no file selected yet) ───────────────────────────────────────────
  return (
    <div>
      {currentPhoto && !preview && (
        <div className="mb-2">
          <img
            src={currentPhoto}
            alt="Current photo"
            style={{ maxWidth: 120, maxHeight: 90, objectFit: 'contain', borderRadius: 4, border: '1px solid #dee2e6' }}
          />
          <div className="form-text">Current photo</div>
        </div>
      )}
      <div className="d-flex gap-2">
        <button type="button" className="btn btn-sm btn-primary" onClick={() => fileRef.current?.click()}>
          <i className="bi bi-folder2-open me-1" />Browse
        </button>
        {currentPhoto && (
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onCrop(null)}>
            <i className="bi bi-x-circle me-1" />Remove
          </button>
        )}
      </div>
      <div className="form-text">Select an image — you will be able to crop it before saving.</div>
      <input ref={fileRef} type="file" accept="image/*" className="d-none" onChange={onFileChange} />
    </div>
  );
}
