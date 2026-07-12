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
import type { ButtonConfig } from "@/App";
import { Button } from "@/components/ui/button";
import ButtonConfigModal from "@/components/ButtonConfigModal";

interface MappingViewProps {
  buttons: ButtonConfig[];
  setButtons: React.Dispatch<React.SetStateAction<ButtonConfig[]>>;
}

function SwapButton({
  button,
  index,
  onClick,
  onDelete,
  dragEnabled,
}: {
  button: ButtonConfig;
  index: number;
  onClick: () => void;
  onDelete: () => void;
  dragEnabled: boolean;
}) {
  const { attributes, listeners, setNodeRef: dragRef, isDragging } = useDraggable({
    id: button.id,
    disabled: !dragEnabled,
  });
  const { setNodeRef: dropRef, isOver } = useDroppable({
    id: button.id,
  });

  const mergedRef = (node: HTMLElement | null) => {
    dragRef(node);
    dropRef(node);
  };

  return (
    <div
      ref={mergedRef}
      className={`group relative flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border bg-secondary transition-all ${
        isDragging ? "opacity-20" : ""
      } ${
        isOver && !isDragging ? "border-primary ring-2 ring-primary/40 shadow-lg shadow-primary/10 scale-105" : "border-border"
      }`}
    >
      <span className="absolute left-1.5 top-1.5 text-[10px] font-medium text-muted-foreground">
        #{index + 1}
      </span>

      {dragEnabled && (
        <button
          {...attributes}
          {...listeners}
          className="absolute right-1.5 top-1.5 cursor-grab active:cursor-grabbing rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          tabIndex={-1}
        >
          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
          </svg>
        </button>
      )}

      {dragEnabled && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity hover:opacity-100"
          tabIndex={-1}
        >
          <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      <button onClick={onClick} className="flex flex-col items-center justify-center gap-0.5 px-1">
        <span className="text-xs font-semibold text-foreground text-center leading-tight">
          {button.label}
        </span>
        {dragEnabled && (
          <span className="text-[10px] text-muted-foreground capitalize">{button.action.type}</span>
        )}
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

export default function MappingView({ buttons, setButtons }: MappingViewProps) {
  const [mapping, setMapping] = useState(buttons.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [gridCols, setGridCols] = useState(4);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const handleSimulatePress = () => {
    const id = crypto.randomUUID();
    const nextNum = buttons.length + 1;
    const newButton: ButtonConfig = {
      id,
      label: `Button ${nextNum}`,
      action: { type: "key", keys: [] },
    };
    setButtons((prev) => [...prev, newButton]);
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

    // Swap positions
    const swapped = [...buttons];
    [swapped[oldIndex], swapped[newIndex]] = [swapped[newIndex], swapped[oldIndex]];
    setButtons(swapped);
  };

  const handleDelete = (id: string) => {
    setButtons((prev) => prev.filter((b) => b.id !== id));
  };

  const activeButton = activeId ? buttons.find((b) => b.id === activeId) : null;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-3">
        {mapping ? (
          <div className="flex items-center gap-2">
            <div className="size-2 animate-pulse rounded-full bg-primary" />
            <span className="text-sm font-medium">Listening for buttons...</span>
            <span className="text-xs text-muted-foreground">
              Press each physical button on your board
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-success" />
            <span className="text-sm font-medium">
              {buttons.length} button{buttons.length !== 1 ? "s" : ""} mapped
            </span>
            <span className="text-xs text-muted-foreground">
              Drag to swap &middot; Click to configure
            </span>
          </div>
        )}

        {buttons.length > 0 && (
          <div className="flex items-center gap-1.5 mr-2">
            <span className="text-xs text-muted-foreground">Grid</span>
            <button
              onClick={() => setGridCols((c) => Math.max(1, c - 1))}
              className="flex size-6 items-center justify-center rounded border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              −
            </button>
            <span className="w-5 text-center text-xs font-medium tabular-nums">{gridCols}</span>
            <button
              onClick={() => setGridCols((c) => Math.min(12, c + 1))}
              className="flex size-6 items-center justify-center rounded border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              +
            </button>
          </div>
        )}

        <div className="flex-1" />

        {mapping && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleSimulatePress}>
              Simulate press
            </Button>
            {buttons.length > 0 && (
              <Button size="sm" onClick={() => setMapping(false)}>
                Finish ({buttons.length})
              </Button>
            )}
          </div>
        )}

        {!mapping && buttons.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => { setButtons([]); setMapping(true); }}>
            Remap
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {buttons.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <div className="flex size-16 items-center justify-center rounded-full bg-secondary">
              <svg className="size-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">No buttons detected</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Click "Start mapping" and press each physical button on your board.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleSimulatePress}>
              Start mapping
            </Button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${gridCols}, 96px)` }}>
              {buttons.map((btn, i) => (
                <SwapButton
                  key={btn.id}
                  button={btn}
                  index={i}
                  dragEnabled={!mapping}
                  onClick={() => setEditingId(btn.id)}
                  onDelete={() => handleDelete(btn.id)}
                />
              ))}
            </div>

            <DragOverlay dropAnimation={null}>
              {activeButton ? <DragCard button={activeButton} /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Config modal */}
      {editingId && (
        <ButtonConfigModal
          button={buttons.find((b) => b.id === editingId)!}
          onSave={(updated) => {
            setButtons((prev) => prev.map((b) => (b.id === editingId ? updated : b)));
            setEditingId(null);
          }}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}
