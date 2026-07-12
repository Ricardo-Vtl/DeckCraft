import { useState } from "react";
import type { ButtonConfig, Profile } from "@/App";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ActionFields from "@/components/ActionFields";

interface ButtonConfigModalProps {
  button: ButtonConfig;
  onSave: (updated: ButtonConfig) => void;
  onClose: () => void;
  profiles?: Profile[];
}

const ACTION_OPTIONS = [
  { value: "key", label: "Record key(s)" },
  { value: "executable", label: "Add executable" },
  { value: "launch", label: "Launch application" },
  { value: "url", label: "Open URL" },
  { value: "text", label: "Type text" },
  { value: "navigate", label: "Profile switch" },
] as const;

export default function ButtonConfigModal({
  button,
  onSave,
  onClose,
  profiles,
}: ButtonConfigModalProps) {
  const [label, setLabel] = useState(button.label);
  const [actionType, setActionType] = useState(button.action.type);
  const initialPayload = (() => {
    const a = button.action;
    if (a.type === "key") return { keys: a.keys.join("+") };
    if (a.type === "executable") return { path: a.path, name: a.name, icon: a.icon ?? "" };
    if (a.type === "launch") return { path: a.path };
    if (a.type === "url") return { url: a.url };
    if (a.type === "text") return { text: a.text };
    if (a.type === "navigate") return { target: a.target, profileId: a.profile ?? "" };
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
      case "url":
        action = { type: "url", url: payload.url ?? "" };
        break;
      case "text":
        action = { type: "text", text: payload.text ?? "" };
        break;
      case "navigate":
        action = {
          type: "navigate",
          target: (payload.target as "next" | "prev" | "profile") ?? "next",
          profile: payload.profileId || undefined,
        };
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
            <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} />
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

          <ActionFields
            actionType={actionType}
            payload={payload}
            onChange={(k, v) => setPayload((p) => ({ ...p, [k]: v }))}
            profiles={profiles}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
