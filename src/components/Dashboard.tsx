import { useState } from "react";
import type { ButtonConfig, DeviceInfo, Profile } from "@/App";
import MappingView from "@/components/views/MappingView";
import CustomizeView from "@/components/views/CustomizeView";
import ProfileManager from "@/components/ProfileManager";

interface DashboardProps {
  device: DeviceInfo;
  profiles: Profile[];
  activeProfileId: string;
  activeProfile: Profile;
  setActiveProfileId: (id: string) => void;
  setButtons: React.Dispatch<React.SetStateAction<ButtonConfig[]>>;
  addProfile: (name: string) => string;
  renameProfile: (id: string, name: string) => void;
  deleteProfile: (id: string) => void;
  onDisconnect: () => void;
}

type Section = "workspace" | "customize" | "profiles" | "settings";

export default function Dashboard({
  device,
  profiles,
  activeProfileId,
  activeProfile,
  setActiveProfileId,
  setButtons,
  addProfile,
  renameProfile,
  deleteProfile,
  onDisconnect,
}: DashboardProps) {
  const [section, setSection] = useState<Section>("workspace");

  const nav = [
    { id: "workspace" as const, label: "Workspace", icon: "M12 4v16m8-8H4" },
    { id: "customize" as const, label: "Customize", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
    { id: "profiles" as const, label: "Profiles", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
    { id: "settings" as const, label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
  ];

  return (
    <div className="flex h-dvh bg-background">
      {/* Left sidebar */}
      <aside className="flex w-14 md:w-56 flex-col border-r border-border bg-card">
        <div className="flex items-center justify-center md:justify-start gap-2.5 border-b border-border px-2 md:px-4 py-3">
          <img src="/deckcraft.svg" alt="DeckCraft" className="size-7 shrink-0" />
          <span className="hidden md:block font-bold text-sm tracking-wide">DeckCraft</span>
        </div>

        <div className="flex items-center justify-center md:justify-start gap-2 border-b border-border px-2 md:px-4 py-2.5">
          <div className="size-2 shrink-0 rounded-full bg-success" />
          <div className="hidden md:block min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">{device.name}</p>
            <p className="truncate text-[10px] text-muted-foreground">{device.port}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 p-1.5 md:p-2">
          {nav.map((s) => {
            const active = section === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                data-active={active || undefined}
                className={`flex w-full items-center justify-center md:justify-start gap-2.5 rounded-md px-2 md:px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-secondary text-foreground font-medium"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                </svg>
                <span className="hidden md:inline">{s.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-border p-1.5 md:p-2">
          <button
            onClick={onDisconnect}
            className="flex w-full items-center justify-center md:justify-start gap-2.5 rounded-md px-2 md:px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden md:inline">Disconnect</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {section === "workspace" && <MappingView buttons={activeProfile.buttons} setButtons={setButtons} profiles={profiles} activeProfileId={activeProfileId} onNavigate={setActiveProfileId} />}
        {section === "customize" && <CustomizeView buttons={activeProfile.buttons} setButtons={setButtons} profiles={profiles} />}
        {section === "profiles" && (
          <ProfileManager
            profiles={profiles}
            activeProfileId={activeProfileId}
            setActiveProfileId={setActiveProfileId}
            addProfile={addProfile}
            renameProfile={renameProfile}
            deleteProfile={deleteProfile}
          />
        )}
        {section === "settings" && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">Settings — coming soon</p>
          </div>
        )}
      </main>
    </div>
  );
}
