'use client';

import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import Image from 'next/image';
import { UploadCloudIcon, XIcon } from './Icons';

/**
 * Accessible pattern: a real, hidden native <input type="file"> is always
 * the primary interaction (keyboard-reachable via the visible label acting
 * as its trigger, opens the OS's own file picker) — drag-and-drop is a
 * progressive enhancement layered on top via onDragOver/onDrop, never the
 * only way in. A drag-only dropzone would be unusable by keyboard.
 */
export function LogoUpload({
  label = 'Logo Upload',
  file,
  onFileChange,
  hint = 'Upload a png file for your logo',
  error,
}: {
  label?: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  hint?: string;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // next/image's built-in optimizer proxies through a server-side route,
  // which can't reach a browser-local blob: URL — `unoptimized` bypasses
  // that proxy and renders the blob URL directly, which is correct here
  // since this is only an ephemeral client-side preview, not a real
  // upload target yet (see design-system/05-imagery-motion.md).
  //
  // createObjectURL must be memoized to `file`, not called inline on every
  // render — each call allocates a new blob URL that stays alive (leaking
  // memory) until explicitly revoked, so re-renders while the same file is
  // still selected (e.g. typing in an unrelated sibling field) would leak
  // one URL per render if this weren't memoized. The effect below revokes
  // the previous URL whenever `file` changes or this component unmounts.
  const previewUrl = useMemo(
    () => (file && file.type.startsWith('image/') ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped) onFileChange(dropped);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-small font-semibold text-secondary">{label}</span>

      {file ? (
        <div className="flex items-center gap-3 rounded-card border border-accent/40 p-3">
          {previewUrl ? (
            <Image src={previewUrl} alt="" width={40} height={40} unoptimized className="size-10 rounded-control object-cover" />
          ) : (
            <div className="size-10 rounded-control bg-secondary/10 flex items-center justify-center text-tiny text-secondary-light">
              file
            </div>
          )}
          <span className="flex-1 truncate text-body text-secondary">{file.name}</span>
          <button
            type="button"
            onClick={() => onFileChange(null)}
            aria-label="Remove logo"
            className="text-secondary-light hover:text-secondary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
          >
            <XIcon />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed p-6 text-center transition-colors ${
            isDragging ? 'border-primary bg-primary/10' : error ? 'border-red-600' : 'border-accent'
          }`}
        >
          <UploadCloudIcon className="size-6 text-accent-dark" />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-body font-semibold text-primary-text hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-control"
          >
            Click to upload or drag and drop
          </button>
          <span className="text-tiny text-secondary-light">{hint}</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png"
        className="sr-only"
        onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
      />

      {error ? <p className="text-small text-red-600">{error}</p> : null}
    </div>
  );
}
