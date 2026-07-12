import { useState } from "react";
import {
  DndContext,
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
  useDraggable,
  useDroppable,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { AppInfo, ButtonConfig } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import AppScannerDialog from "@/components/AppScannerDialog";

interface CustomizeViewProps {
  buttons: ButtonConfig[];
  setButtons: React.Dispatch<React.SetStateAction<ButtonConfig[]>>;
}

type ActionMode = "executable" | "key" | "launch";

function SwapButton({
  button,
  index,
  onClick,
}: {
  button: ButtonConfig;
  index: number;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef: dragRef, isDragging } = useDraggable({ id: button.id });
  const { setNodeRef: dropRef, isOver } = useDroppable({ id: button.id });

  const mergedRef = (node: HTMLElement | null) => {
    dragRef(node);
    dropRef(node);
  };

  return (
    <div
      ref={mergedRef}
      className={`relative flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border bg-secondary transition-all cursor-pointer ${
        isDragging ? "opacity-20" : ""
      } ${
        isOver && !isDragging ? "border-primary ring-2 ring-primary/40 shadow-lg shadow-primary/10 scale-105" : "border-border"
      }`}
    >
      <span className="absolute left-1.5 top-1.5 text-[10px] font-medium text-muted-foreground">
        #{index + 1}
      </span>

      <button {...attributes} {...listeners} className="absolute right-1.5 top-1.5 cursor-grab active:cursor-grabbing rounded p-0.5 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100" tabIndex={-1}>
        <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
        </svg>
      </button>

      <button onClick={onClick} className="flex flex-col items-center justify-center gap-0.5 px-1">
        <span className="text-xs font-semibold text-foreground text-center leading-tight">
          {button.label}
        </span>
        <span className="text-[10px] text-muted-foreground capitalize">
          {button.action.type === "executable" ? button.action.name : button.action.type}
        </span>
      </button>
    </div>
  );
}

function DragCard({ button }: { button: ButtonConfig }) {
  return (
    <div className="flex aspect-square w-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-primary bg-secondary shadow-xl">
      <span className="text-xs font-semibold text-foreground text-center leading-tight px-1">
        {button.label}
      </span>
    </div>
  );
}

export default function CustomizeView({ buttons, setButtons }: CustomizeViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [gridCols, setGridCols] = useState(4);
  const [scannerOpen, setScannerOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const selected = selectedId ? buttons.find((b) => b.id === selectedId) : null;

  const [editLabel, setEditLabel] = useState("");
  const [editActionMode, setEditActionMode] = useState<ActionMode>("key");
  const [editKeys, setEditKeys] = useState("");
  const [editExeName, setEditExeName] = useState("");
  const [editExePath, setEditExePath] = useState("");
  const [editLaunchPath, setEditLaunchPath] = useState("");

  const selectButton = (id: string) => {
    const btn = buttons.find((b) => b.id === id);
    if (!btn) return;
    setSelectedId(id);
    setEditLabel(btn.label);

    const a = btn.action;
    if (a.type === "key") {
      setEditActionMode("key");
      setEditKeys(a.keys.join("+"));
      setEditExeName("");
      setEditExePath("");
      setEditLaunchPath("");
    } else if (a.type === "executable") {
      setEditActionMode("executable");
      setEditKeys("");
      setEditExeName(a.name);
      setEditExePath(a.path);
      setEditLaunchPath("");
    } else {
      setEditActionMode("launch");
      setEditKeys("");
      setEditExeName("");
      setEditExePath("");
      setEditLaunchPath(a.path);
    }
  };

  const handleSave = () => {
    if (!selectedId || !selected) return;
    let action: ButtonConfig["action"];
    switch (editActionMode) {
      case "key":
        action = { type: "key", keys: editKeys ? editKeys.split("+").map((k) => k.trim()) : [] };
        break;
      case "executable":
        action = { type: "executable", name: editExeName || editLaunchPath.split("\\").pop()?.replace(/\.\w+$/, "") || "App", path: editExePath };
        break;
      case "launch":
        action = { type: "launch", path: editLaunchPath };
        break;
    }
    setButtons((prev) => prev.map((b) => (b.id === selectedId ? { ...b, label: editLabel, action } : b)));
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = buttons.findIndex((b) => b.id === active.id);
    const newIndex = buttons.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const swapped = [...buttons];
    [swapped[oldIndex], swapped[newIndex]] = [swapped[newIndex], swapped[oldIndex]];
    setButtons(swapped);
  };

  const activeButton = activeId ? buttons.find((b) => b.id === activeId) : null;

  const handleSelectScannedApp = (app: AppInfo) => {
    setEditActionMode("executable");
    setEditExeName(app.name);
    setEditExePath(app.path);
  };

  return (
    <div className="flex h-full">
      {/* Grid */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border px-6 py-3">
          <span className="text-sm font-medium">
            {buttons.length} button{buttons.length !== 1 ? "s" : ""}
          </span>
          <span className="text-xs text-muted-foreground">
            Click a button to configure &middot; Drag to swap
          </span>

          {buttons.length > 0 && (
            <div className="flex items-center gap-1.5 ml-4">
              <span className="text-xs text-muted-foreground">Grid</span>
              <button onClick={() => setGridCols((c) => Math.max(1, c - 1))} className="flex size-6 items-center justify-center rounded border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">−</button>
              <span className="w-5 text-center text-xs font-medium tabular-nums">{gridCols}</span>
              <button onClick={() => setGridCols((c) => Math.min(12, c + 1))} className="flex size-6 items-center justify-center rounded border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">+</button>
            </div>
          )}

          <div className="flex-1" />
        </div>

        <div className="flex-1 overflow-auto p-6">
          {buttons.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">No buttons mapped yet. Go to Workspace first.</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${gridCols}, 96px)` }}>
                {buttons.map((btn, i) => (
                  <div key={btn.id} className="group" onClick={() => selectButton(btn.id)}>
                    <SwapButton button={btn} index={i} onClick={() => selectButton(btn.id)} />
                  </div>
                ))}
              </div>
              <DragOverlay dropAnimation={null}>
                {activeButton ? <DragCard button={activeButton} /> : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </div>

      {/* Right inspector — always visible */}
      <aside className="w-80 shrink-0 border-l border-border bg-card flex flex-col">
        {selected ? (
          <>
            <div className="border-b border-border px-4 py-3">
              <span className="text-sm font-medium">Configure</span>
              <p className="text-xs text-muted-foreground truncate">{selected.label}</p>
            </div>

            <div className="flex-1 overflow-auto space-y-5 p-4">
              {/* Label */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-label">Button label</Label>
                <Input id="edit-label" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
              </div>

              <div className="border-t border-border" />

              {/* Action type selector — radio-like sections */}
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</span>

                {/* 1. Quick App — scan system */}
                <label
                  data-active={editActionMode === "executable" || undefined}
                  className={`block cursor-pointer rounded-lg border p-3 transition-colors ${
                    editActionMode === "executable"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-secondary"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="action-mode"
                      checked={editActionMode === "executable"}
                      onChange={() => setEditActionMode("executable")}
                      className="mt-0.5 size-4 accent-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">Add Executable</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Scan system for installed applications
                      </p>

                      {editActionMode === "executable" && (
                        <div className="mt-3 space-y-3">
                          {editExePath ? (
                            <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary p-3">
                              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                                <svg className="size-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                                </svg>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground truncate">{editExeName}</p>
                                <p className="text-xs text-muted-foreground truncate">{editExePath}</p>
                              </div>
                              <button onClick={() => { setEditExeName(""); setEditExePath(""); }} className="shrink-0 text-muted-foreground hover:text-foreground">
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
                      )}
                    </div>
                  </div>
                </label>

                {/* 2. Key Recorder */}
                <label
                  data-active={editActionMode === "key" || undefined}
                  className={`block cursor-pointer rounded-lg border p-3 transition-colors ${
                    editActionMode === "key"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-secondary"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="action-mode"
                      checked={editActionMode === "key"}
                      onChange={() => setEditActionMode("key")}
                      className="mt-0.5 size-4 accent-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">Key Recorder</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Press a key combination to record it
                      </p>

                      {editActionMode === "key" && (
                        <div className="mt-3">
                          <KeyRecorderInline value={editKeys} onChange={setEditKeys} />
                          <p className="text-xs text-muted-foreground mt-1.5">
                            Click Record and press your key combination, then click Save.
                          </p>
                          <p className="text-xs text-muted-foreground/60 mt-0.5">
                            Capturado a nivel de sistema — cualquier combinación funciona.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </label>

                {/* 3. Browse File */}
                <label
                  data-active={editActionMode === "launch" || undefined}
                  className={`block cursor-pointer rounded-lg border p-3 transition-colors ${
                    editActionMode === "launch"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-secondary"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="action-mode"
                      checked={editActionMode === "launch"}
                      onChange={() => setEditActionMode("launch")}
                      className="mt-0.5 size-4 accent-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">Application App</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Browse for any executable on your system
                      </p>

                      {editActionMode === "launch" && (
                        <div className="mt-3 flex items-center gap-2">
                          <Input
                            placeholder="C:\Path\to\app.exe"
                            value={editLaunchPath}
                            onChange={(e) => setEditLaunchPath(e.target.value)}
                            className="flex-1 h-8 text-xs"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={async () => {
                              const file = await open({
                                multiple: false,
                                filters: [
                                  { name: "Applications", extensions: ["exe", "bat", "cmd", "lnk", "com"] },
                                  { name: "All files", extensions: ["*"] },
                                ],
                              });
                              if (file) setEditLaunchPath(file);
                            }}
                          >
                            Browse
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end border-t border-border p-4">
              <Button size="sm" onClick={handleSave}>Save</Button>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center p-6">
            <p className="text-sm text-muted-foreground text-center leading-relaxed">
              Select a button<br />from the grid to<br />configure it
            </p>
          </div>
        )}
      </aside>

      <AppScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onSelect={handleSelectScannedApp}
      />
    </div>
  );
}

/** Inline key recorder for the radio-button layout */
function KeyRecorderInline({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [recording, setRecording] = useState(false);

  const record = async () => {
    setRecording(true);
    try {
      const combo = await invoke<string>("capture_key_combo");
      if (combo) onChange(combo);
    } catch { /* ignore */ }
    setRecording(false);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 flex-1 items-center rounded-md border border-border bg-secondary px-2.5 text-xs font-mono text-foreground">
        {recording ? (
          <span className="text-primary animate-pulse">Press keys...</span>
        ) : value ? (
          <span>{value}</span>
        ) : (
          <span className="text-muted-foreground">No keys recorded</span>
        )}
      </div>
      <Button
        variant={recording ? "default" : "outline"}
        size="sm"
        className="shrink-0"
        onClick={record}
        disabled={recording}
      >
        {recording ? (
          <>Listening...</>
        ) : (
          <>
            <svg className="mr-1 size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
            </svg>
            Record
          </>
        )}
      </Button>
    </div>
  );
}
