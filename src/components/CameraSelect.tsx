import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

export interface CameraOption {
  label: string;
  pixelPitch: number;
}

interface CameraSelectProps {
  cameras: CameraOption[];
  value: number; // index into `cameras`, or -1 for "Nessuna"
  onChange: (index: number) => void;
  disabled?: boolean;
}

/**
 * Searchable dropdown standing in for a plain <select> once the camera list
 * grows too long to browse comfortably (currently ~65 models). Filters by
 * substring match against the label, so typing a brand ("QHY", "Canon") or a
 * model number narrows the list instantly.
 */
export const CameraSelect: React.FC<CameraSelectProps> = ({ cameras, value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const withIdx = cameras.map((c, idx) => ({ ...c, idx }));
    const q = query.trim().toLowerCase();
    if (!q) return withIdx;
    return withIdx.filter((c) => c.label.toLowerCase().includes(q));
  }, [cameras, query]);

  const selectedCamera = value >= 0 ? cameras[value] : undefined;
  const selectedLabel = selectedCamera ? `${selectedCamera.label} (${selectedCamera.pixelPitch} µm)` : 'Nessuna';

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="w-full bg-neutral-950 border border-neutral-700 text-xs font-semibold text-neutral-200 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2 disabled:opacity-40"
      >
        <span className="truncate text-left">{selectedLabel}</span>
        <ChevronDown className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-neutral-950 border border-neutral-700 rounded-lg overflow-hidden">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-neutral-800">
            <Search className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca modello o marca..."
              className="w-full bg-transparent text-xs text-neutral-200 focus:outline-none placeholder:text-neutral-600"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                onChange(-1);
                setOpen(false);
              }}
              className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-neutral-800 ${
                value === -1 ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-300'
              }`}
            >
              Nessuna
            </button>
            {filtered.length === 0 && (
              <div className="px-2.5 py-3 text-[11px] text-neutral-500 text-center">Nessun modello trovato</div>
            )}
            {filtered.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => {
                  onChange(c.idx);
                  setOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-neutral-800 ${
                  value === c.idx ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-300'
                }`}
              >
                {c.label} <span className="text-neutral-500">({c.pixelPitch} µm)</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
