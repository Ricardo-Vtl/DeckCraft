import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import AppScannerDialog from "@/components/AppScannerDialog";
import type { AppInfo } from "@/App";

interface ActionFieldsProps {
  actionType: string;
  payload: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

function KeyRecorder({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [recording, setRecording] = useState(false);

  const record = async () => {
    setRecording(true);
    try {
      const combo = await invoke<string>("capture_key_combo");
      if (combo) onChange(combo);
    } catch { /* ignore */ }
    setRecording(false);
  };

  if (recording) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex h-9 flex-1 items-center rounded-md border border-primary bg-secondary px-3 text-sm text-foreground animate-pulse">
          Press a key combination...
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        id="keys"
        placeholder="e.g. Ctrl+Shift+V"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1"
      />
      <Button variant="outline" size="sm" onClick={record}>
        <svg className="mr-1 size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </svg>
        Record
      </Button>
    </div>
  );
}

export default function ActionFields({ actionType, payload, onChange }: ActionFieldsProps) {
  const [scannerOpen, setScannerOpen] = useState(false);

  switch (actionType) {
    case "key":
      return (
        <div className="space-y-1.5">
          <Label htmlFor="keys">Key combination</Label>
          <KeyRecorder
            value={payload.keys ?? ""}
            onChange={(v) => onChange("keys", v)}
          />
          <p className="text-xs text-muted-foreground">
            Capturado a nivel de sistema — hasta combinaciones de sistema como Win+R.
          </p>
        </div>
      );

    case "executable":
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Application</Label>
            {payload.path ? (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary p-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <svg className="size-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{payload.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{payload.path}</p>
                </div>
                <button onClick={() => { onChange("path", ""); onChange("name", ""); onChange("icon", ""); }} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => setScannerOpen(true)} className="w-full">
              <svg className="mr-1.5 size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Scan system for applications
            </Button>
          </div>
          <AppScannerDialog
            open={scannerOpen}
            onOpenChange={setScannerOpen}
            onSelect={(app: AppInfo) => {
              onChange("name", app.name);
              onChange("path", app.path);
              setScannerOpen(false);
            }}
          />
        </div>
      );

    case "launch":
      return (
        <div className="space-y-1.5">
          <Label htmlFor="path">Application path</Label>
          <div className="flex items-center gap-2">
            <Input
              id="path"
              placeholder="e.g. C:\Program Files\...\app.exe"
              value={payload.path ?? ""}
              onChange={(e) => onChange("path", e.target.value)}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const file = await open({
                  multiple: false,
                  filters: [
                    { name: "Applications", extensions: ["exe", "bat", "cmd", "lnk", "com"] },
                    { name: "All files", extensions: ["*"] },
                  ],
                });
                if (file) onChange("path", file);
              }}
            >
              <svg className="mr-1 size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Browse
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Select the .exe file using the native Windows file browser.
          </p>
        </div>
      );

    default:
      return null;
  }
}
