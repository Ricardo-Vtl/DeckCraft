import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { AppInfo } from "@/App";

interface AppScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (app: AppInfo) => void;
}

export default function AppScannerDialog({ open, onOpenChange, onSelect }: AppScannerDialogProps) {
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSearch("");
    invoke<AppInfo[]>("scan_apps")
      .then(setApps)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open]);

  const handleRescan = () => {
    setLoading(true);
    setSearch("");
    invoke<AppInfo[]>("scan_apps")
      .then(setApps)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const filtered = search.trim()
    ? apps.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    : apps;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Scan system for applications</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Search applications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <button
            onClick={handleRescan}
            disabled={loading}
            className="shrink-0 rounded-md border border-input bg-transparent px-3 h-9 text-xs hover:bg-secondary transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Rescan
          </button>
        </div>

        <div className="flex-1 overflow-auto min-h-0 -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <svg className="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Scanning system...
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">
                {search ? "No applications match your search." : "No applications found."}
              </p>
            </div>
          ) : (
            <div className="space-y-0.5 py-2">
              {filtered.map((app) => (
                <button
                  key={app.path}
                  onClick={() => onSelect(app)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted overflow-hidden">
                    {app.icon ? (
                      <img src={app.icon} alt="" className="size-full object-cover" />
                    ) : (
                      <svg className="size-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{app.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{app.path}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {!loading && (
          <p className="text-xs text-muted-foreground text-center pt-1">
            {apps.length} application{apps.length !== 1 ? "s" : ""} found
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
