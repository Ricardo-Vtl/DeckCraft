import { useState } from "react";
import type { Profile } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ProfileManagerProps {
  profiles: Profile[];
  activeProfileId: string;
  setActiveProfileId: (id: string) => void;
  addProfile: (name: string) => string;
  renameProfile: (id: string, name: string) => void;
  deleteProfile: (id: string) => void;
}

export default function ProfileManager({
  profiles,
  activeProfileId,
  setActiveProfileId,
  addProfile,
  renameProfile,
  deleteProfile,
}: ProfileManagerProps) {
  const [newName, setNewName] = useState("");

  const handleAdd = () => {
    if (!newName.trim()) return;
    addProfile(newName.trim());
    setNewName("");
  };

  return (
    <div className="flex h-full flex-col p-4 md:p-6 max-w-full md:max-w-lg">
      <h2 className="text-lg font-semibold mb-1">Profiles</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Each profile has its own button layout. Switch between them with a button action.
      </p>

      <div className="flex items-center gap-2 mb-4">
        <Input
          placeholder="New profile name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button size="sm" onClick={handleAdd}>Add</Button>
      </div>

      <div className="flex-1 space-y-1 overflow-auto">
        {profiles.map((p) => {
          const active = p.id === activeProfileId;
          return (
            <div
              key={p.id}
              data-active={active || undefined}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                active ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <input
                type="radio"
                name="profile"
                checked={active}
                onChange={() => setActiveProfileId(p.id)}
                className="size-4 accent-primary"
              />
              <ProfileNameEditor
                name={p.name}
                onSave={(name) => renameProfile(p.id, name)}
              />
              <span className="text-xs text-muted-foreground ml-auto">
                {p.buttons.length} btn{p.buttons.length !== 1 ? "s" : ""}
              </span>
              {profiles.length > 1 && (
                <button
                  onClick={() => deleteProfile(p.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProfileNameEditor({ name, onSave }: { name: string; onSave: (n: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  if (editing) {
    return (
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => { onSave(value); setEditing(false); }}
        onKeyDown={(e) => { if (e.key === "Enter") { onSave(value); setEditing(false); } }}
        className="h-7 text-sm flex-1"
        autoFocus
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="min-w-0 flex-1 text-left text-sm font-medium text-foreground truncate hover:text-primary transition-colors"
    >
      {name}
    </button>
  );
}
