import { useState, useRef, useCallback, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
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
import type { AppInfo, ButtonConfig, Profile } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { open } from "@tauri-apps/plugin-dialog";
import AppScannerDialog from "@/components/AppScannerDialog";

interface CustomizeViewProps {
  buttons: ButtonConfig[];
  setButtons: React.Dispatch<React.SetStateAction<ButtonConfig[]>>;
  profiles?: Profile[];
}

type ActionMode = "executable" | "key" | "launch" | "url" | "text" | "navigate";

function SwapButton({
  button,
  index,
  onClick,
  lit,
  onLitEnd,
}: {
  button: ButtonConfig;
  index: number;
  onClick: () => void;
  lit: boolean;
  onLitEnd?: () => void;
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
      onAnimationEnd={lit ? onLitEnd : undefined}
      className={`relative flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border bg-secondary transition-all cursor-pointer ${
        isDragging ? "opacity-20" : ""
      } ${
        isOver && !isDragging ? "border-primary ring-2 ring-primary/40 shadow-lg shadow-primary/10 scale-105" : "border-border"
      } ${lit ? "animate-lit-flash" : ""}`}
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

export default function CustomizeView({ buttons, setButtons, profiles }: CustomizeViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [gridCols, setGridCols] = useState(4);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [litId, setLitId] = useState<string | null>(null);

  useEffect(() => {
    let unsubDown: (() => void) | undefined;
    let unsubUp: (() => void) | undefined;

    listen<{ id: number }>("button-down", (event) => {
      const btn = buttons.find((b) => b.physicalId === event.payload.id);
      if (btn) {
        setLitId(null);
        requestAnimationFrame(() => setLitId(btn.id));
      }
    }).then((fn) => { unsubDown = fn; });

    listen<{ id: number }>("button-up", () => {
      setLitId(null);
    }).then((fn) => { unsubUp = fn; });

    return () => { unsubDown?.(); unsubUp?.(); };
  }, [buttons]);

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
  const [editUrl, setEditUrl] = useState("");
  const [editText, setEditText] = useState("");
  const [editTarget, setEditTarget] = useState<"next" | "prev" | "profile">("next");
  const [editProfileId, setEditProfileId] = useState("");

  const selectButton = (id: string) => {
    const btn = buttons.find((b) => b.id === id);
    if (!btn) return;
    setSelectedId(id);
    setEditLabel(btn.label);

    const resetCommon = () => {
      setEditKeys("");
      setEditExeName("");
      setEditExePath("");
      setEditLaunchPath("");
      setEditUrl("");
      setEditText("");
      setEditTarget("next");
      setEditProfileId("");
    };

    const a = btn.action;
    switch (a.type) {
      case "key":
        resetCommon();
        setEditActionMode("key");
        setEditKeys(a.keys.join("+"));
        break;
      case "executable":
        resetCommon();
        setEditActionMode("executable");
        setEditExeName(a.name);
        setEditExePath(a.path);
        break;
      case "launch":
        resetCommon();
        setEditActionMode("launch");
        setEditLaunchPath(a.path);
        break;
      case "url":
        resetCommon();
        setEditActionMode("url");
        setEditUrl(a.url);
        break;
      case "text":
        resetCommon();
        setEditActionMode("text");
        setEditText(a.text);
        break;
      case "navigate":
        resetCommon();
        setEditActionMode("navigate");
        setEditTarget(a.target);
        setEditProfileId(a.profile ?? "");
        break;
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
      case "url":
        action = { type: "url", url: editUrl };
        break;
      case "text":
        action = { type: "text", text: editText };
        break;
      case "navigate":
        action = { type: "navigate", target: editTarget, profile: editTarget === "profile" ? editProfileId : undefined };
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
                    <SwapButton button={btn} index={i} lit={btn.id === litId} onLitEnd={() => setLitId(null)} onClick={() => selectButton(btn.id)} />
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

                {/* 1. Quick App */}
                <label
                  data-active={editActionMode === "executable" || undefined}
                  className={`block cursor-pointer rounded-lg border p-3 transition-colors ${
                    editActionMode === "executable" ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"
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
                      <p className="text-xs text-muted-foreground mt-0.5">Scan system for installed applications</p>
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
                    editActionMode === "key" ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"
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
                      <p className="text-xs text-muted-foreground mt-0.5">Press a key combination to record it</p>
                      {editActionMode === "key" && (
                        <div className="mt-3">
                          <KeyRecorderInline value={editKeys} onChange={setEditKeys} />
                          <p className="text-xs text-muted-foreground mt-1.5">Click Record and press your key combination.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </label>

                {/* 3. Browse File */}
                <label
                  data-active={editActionMode === "launch" || undefined}
                  className={`block cursor-pointer rounded-lg border p-3 transition-colors ${
                    editActionMode === "launch" ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"
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
                      <p className="text-xs text-muted-foreground mt-0.5">Browse for any executable on your system</p>
                      {editActionMode === "launch" && (
                        <div className="mt-3 flex items-center gap-2">
                          <Input placeholder="C:\Path\to\app.exe" value={editLaunchPath} onChange={(e) => setEditLaunchPath(e.target.value)} className="flex-1 h-8 text-xs" />
                          <Button variant="outline" size="sm" className="shrink-0" onClick={async () => {
                            const file = await open({
                              multiple: false,
                              filters: [
                                { name: "Applications", extensions: ["exe", "bat", "cmd", "lnk", "com"] },
                                { name: "All files", extensions: ["*"] },
                              ],
                            });
                            if (file) setEditLaunchPath(file);
                          }}>
                            Browse
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </label>

                {/* 4. Open URL */}
                <label
                  data-active={editActionMode === "url" || undefined}
                  className={`block cursor-pointer rounded-lg border p-3 transition-colors ${
                    editActionMode === "url" ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="action-mode"
                      checked={editActionMode === "url"}
                      onChange={() => setEditActionMode("url")}
                      className="mt-0.5 size-4 accent-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">Open URL</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Opens a URL in your default browser</p>
                      {editActionMode === "url" && (
                        <div className="mt-3">
                          <Input placeholder="https://example.com" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} className="h-8 text-xs" />
                        </div>
                      )}
                    </div>
                  </div>
                </label>

                {/* 5. Type Text */}
                <label
                  data-active={editActionMode === "text" || undefined}
                  className={`block cursor-pointer rounded-lg border p-3 transition-colors ${
                    editActionMode === "text" ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="action-mode"
                      checked={editActionMode === "text"}
                      onChange={() => setEditActionMode("text")}
                      className="mt-0.5 size-4 accent-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">Type Text</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Types text using keyboard simulation</p>
                      {editActionMode === "text" && (
                        <div className="mt-3">
                          <textarea
                            placeholder="Hello, world!"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="flex min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </label>

                {/* 6. Profile Switch */}
                <label
                  data-active={editActionMode === "navigate" || undefined}
                  className={`block cursor-pointer rounded-lg border p-3 transition-colors ${
                    editActionMode === "navigate" ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="action-mode"
                      checked={editActionMode === "navigate"}
                      onChange={() => setEditActionMode("navigate")}
                      className="mt-0.5 size-4 accent-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">Profile Switch</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Switch to another profile</p>
                      {editActionMode === "navigate" && (
                        <div className="mt-3 space-y-2">
                          <select
                            value={editTarget}
                            onChange={(e) => setEditTarget(e.target.value as "next" | "prev" | "profile")}
                            className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            <option value="next">Next profile</option>
                            <option value="prev">Previous profile</option>
                            <option value="profile">Specific profile</option>
                          </select>
                          {editTarget === "profile" && profiles && (
                            <select
                              value={editProfileId}
                              onChange={(e) => setEditProfileId(e.target.value)}
                              className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                              <option value="">Select...</option>
                              {profiles.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border p-4">
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
  const refs = useRef<{ onChange: (v: string) => void }>({ onChange });
  refs.current.onChange = onChange;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const parts: string[] = [];
    if (e.ctrlKey) parts.push("Ctrl");
    if (e.shiftKey) parts.push("Shift");
    if (e.altKey) parts.push("Alt");
    if (e.metaKey) parts.push("Win");

    const code = e.code;
    const mods = ["ControlLeft", "ControlRight", "ShiftLeft", "ShiftRight", "AltLeft", "AltRight", "MetaLeft", "MetaRight"];
    if (!mods.includes(code)) {
      let mapped: string | null = null;
      if (code.startsWith("Digit")) mapped = code.slice(5);
      else if (code.startsWith("Key")) mapped = code.slice(3);
      else if (code.startsWith("F") && !isNaN(Number(code.slice(1)))) mapped = code;
      else if (code === "Space") mapped = "Space";
      else if (code === "Enter") mapped = "Enter";
      else if (code === "Backspace") mapped = "Backspace";
      else if (code === "Tab") mapped = "Tab";
      else if (code === "Escape") mapped = "Escape";
      else if (code === "Delete") mapped = "Delete";
      else if (code === "Home") mapped = "Home";
      else if (code === "End") mapped = "End";
      else if (code === "PageUp") mapped = "PageUp";
      else if (code === "PageDown") mapped = "PageDown";
      else if (code === "Insert") mapped = "Insert";
      else if (code === "ArrowUp") mapped = "Up";
      else if (code === "ArrowDown") mapped = "Down";
      else if (code === "ArrowLeft") mapped = "Left";
      else if (code === "ArrowRight") mapped = "Right";
      // fallback: use e.key for media/unknown keys (Fn combos generate Media* events)
      else if (e.key.startsWith("Media") || e.key.startsWith("Launch") || e.key.startsWith("Audio")) mapped = e.key;
      if (mapped) {
        parts.push(mapped);
        refs.current.onChange(parts.join("+"));
        setRecording(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!recording) return;
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [recording, handleKeyDown]);

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
      <Button variant={recording ? "default" : "outline"} size="sm" className="shrink-0" onClick={() => setRecording(true)}>
        {recording ? <>Listening...</> : <><svg className="mr-1 size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" fill="currentColor" /></svg>Record</>}
      </Button>
    </div>
  );
}
