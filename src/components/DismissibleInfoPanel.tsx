import React, { useState } from 'react';
import { X } from 'lucide-react';

const STORAGE_KEY = 'astrocal:dismissed-panels';

function loadDismissedIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveDismissedIds(ids: Set<string>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Storage unavailable (quota exceeded, private browsing, etc.) - ignore
  }
}

interface DismissibleInfoPanelProps {
  id: string;
  icon: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export const DismissibleInfoPanel: React.FC<DismissibleInfoPanelProps> = ({ id, icon, className, children }) => {
  const [dismissed, setDismissed] = useState<boolean>(() => loadDismissedIds().has(id));

  if (dismissed) return null;

  const handleDismiss = () => {
    const ids = loadDismissedIds();
    ids.add(id);
    saveDismissedIds(ids);
    setDismissed(true);
  };

  return (
    <div className={className}>
      {icon}
      <div className="flex-1">{children}</div>
      <button
        onClick={handleDismiss}
        aria-label="Chiudi"
        title="Chiudi"
        className="shrink-0 p-1 -m-1 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 transition"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
