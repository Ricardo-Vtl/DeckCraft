import { useState } from "react";
import type { ButtonConfig } from "@/App";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ActionFields from "@/components/ActionFields";

interface ButtonConfigModalProps {
  button: ButtonConfig;
  onSave: (updated: ButtonConfig) => void;
  onClose: () => void;
}

const ACTION_OPTIONS = [
  { value: "key", label: "Record key(s)" },
  { value: "executable", label: "Add executable" },
  { value: "launch", label: "Launch application" },
] as const;

export default function ButtonConfigModal({ button, onSave, onClose }: ButtonConfigModalProps) {
  const [label, setLabel] = useState(button.label);
  const [actionType, setActionType] = useState(button.action.type);
  const initialPayload = (() => {
    const a = button.action;
    if (a.type === "key") return { keys: a.keys.join("+") };
    if (a.type === "executable") return { path: a.path, name: a.name, icon: a.icon ?? "" };
    if (a.type === "launch") return { path: a.path };
    return {};
  })() as Record<string, string>;
  const [payload, setPayload] = useState<Record<string, string>>(initialPayload);

  const handleSave = () => {
    let action: ButtonConfig["action"];

    switch (actionType) {
      case "key":
        action = { type: "key", keys: payload.keys ? payload.keys.split("+").map((k) => k.trim()) : [] };
        break;
      case "executable":
        action = { type: "executable", name: payload.name ?? "", path: payload.path ?? "" };
        break;
      case "launch":
        action = { type: "launch", path: payload.path ?? "" };
        break;
      default:
        action = button.action;
    }

    onSave({ ...button, label, action });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure {label}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="label">Button label</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="action">Action</Label>
            <select
              id="action"
              value={actionType}
              onChange={(e) => setActionType(e.target.value as typeof actionType)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <ActionFields actionType={actionType} payload={payload} onChange={(k, v) => setPayload((p) => ({ ...p, [k]: v }))} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
