'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { CameraIcon, RetakeIcon } from './Icons';

/**
 * ID document capture, camera-first — a front-desk agent is holding the
 * guest's own physical ID at the counter; asking them to "upload a file"
 * (the original `LogoUpload`-based picker this replaced) implies emailing
 * or transferring the photo from somewhere else, which was never the real
 * workflow. `getUserMedia` opens the device's own camera directly into a
 * live preview; "Capture" snapshots the current frame to a canvas and
 * hands back a plain base64 JPEG (no `"data:"` prefix — matches
 * `IdDocumentInput.photoBase64`'s own contract). A plain file-picker stays
 * as a fallback link, not the primary action — for a desktop with no
 * webcam, a denied camera permission, or a photo already taken some other
 * way.
 */
export function CameraCapture({
  label,
  hint,
  photoBase64,
  onCapture,
}: {
  label: string;
  hint?: string;
  /** Base64, no `"data:"` prefix. `null` = nothing captured yet. */
  photoBase64: string | null;
  onCapture: (base64: string | null) => void;
}) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  // Release the camera if the agent navigates away mid-capture — a live
  // camera left running in the background is both a battery drain and a
  // real privacy concern (a device camera light staying lit with nothing
  // on screen using it).
  useEffect(() => stopStream, []);

  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setCameraActive(true);
      // The <video> element only mounts once `cameraActive` is true, so its
      // ref isn't attached yet on this same synchronous pass — hand off the
      // stream once React has actually rendered it.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setCameraError('Could not access the camera — check site permissions, or upload a photo instead.');
    }
  }

  function cancelCamera() {
    stopStream();
    setCameraActive(false);
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    onCapture(canvas.toDataURL('image/jpeg', 0.85).replace(/^data:.*;base64,/, ''));
    cancelCamera();
  }

  function retake() {
    onCapture(null);
    void startCamera();
  }

  function handleFilePicked(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onCapture(String(reader.result).replace(/^data:.*;base64,/, ''));
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-small font-semibold text-secondary">{label}</span>

      {photoBase64 ? (
        <div className="flex flex-col items-start gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- a captured/uploaded data: URI, not an app asset next/image can optimize */}
          <img src={`data:image/jpeg;base64,${photoBase64}`} alt="Captured ID document" className="max-h-48 w-auto rounded-card border border-secondary-light/40" />
          <Button type="button" variant="outline" size="sm" onClick={retake}>
            <RetakeIcon className="size-4" /> Retake
          </Button>
        </div>
      ) : cameraActive ? (
        <div className="flex flex-col items-start gap-2">
          <video ref={videoRef} muted playsInline className="max-h-64 w-auto rounded-card border border-secondary-light/40 bg-black" />
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={capture}>
              <CameraIcon className="size-4" /> Capture
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={cancelCamera}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-2 rounded-card border-2 border-dashed border-secondary-light p-4">
          <Button type="button" size="sm" onClick={() => void startCamera()}>
            <CameraIcon className="size-4" /> Open Camera
          </Button>
          {cameraError ? <p className="text-small text-red-600">{cameraError}</p> : null}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-small text-secondary-light underline hover:text-secondary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-control"
          >
            or upload a photo instead
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={(event) => handleFilePicked(event.target.files?.[0] ?? null)} />
          {hint ? <span className="text-tiny text-secondary-light">{hint}</span> : null}
        </div>
      )}
    </div>
  );
}
