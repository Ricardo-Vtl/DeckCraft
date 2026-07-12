import { useState } from "react";
import WelcomeView from "@/components/views/WelcomeView";
import Dashboard from "@/components/Dashboard";

export interface AppInfo {
  name: string;
  path: string;
}

export interface Profile {
  id: string;
  name: string;
  buttons: ButtonConfig[];
}

export interface ButtonConfig {
  id: string;
  label: string;
  action:
    | { type: "key"; keys: string[] }
    | { type: "executable"; name: string; path: string; icon?: string }
    | { type: "launch"; path: string }
    | { type: "url"; url: string }
    | { type: "text"; text: string }
    | { type: "navigate"; target: "next" | "prev" | "profile"; profile?: string };
}

export interface DeviceInfo {
  name: string;
  port: string;
  type: "serial" | "hid";
}

let profileCounter = 0;

export default function App() {
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([
    { id: "default", name: "Default", buttons: [] },
  ]);
  const [activeProfileId, setActiveProfileId] = useState("default");

  const activeProfile = profiles.find((p) => p.id === activeProfileId)!;

  const setButtons = (fn: React.SetStateAction<ButtonConfig[]>) => {
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === activeProfileId ? { ...p, buttons: typeof fn === "function" ? fn(p.buttons) : fn } : p,
      ),
    );
  };

  const addProfile = (name: string) => {
    profileCounter++;
    const id = `profile_${Date.now()}`;
    setProfiles((prev) => [...prev, { id, name: name || `Profile ${profileCounter}`, buttons: [] }]);
    return id;
  };

  const renameProfile = (id: string, name: string) => {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  };

  const deleteProfile = (id: string) => {
    if (profiles.length <= 1) return;
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    if (activeProfileId === id) {
      setActiveProfileId(profiles.find((p) => p.id !== id)!.id);
    }
  };

  if (!device) {
    return <WelcomeView onConnected={setDevice} />;
  }

  return (
    <Dashboard
      device={device}
      profiles={profiles}
      activeProfileId={activeProfileId}
      activeProfile={activeProfile}
      setActiveProfileId={setActiveProfileId}
      setButtons={setButtons}
      addProfile={addProfile}
      renameProfile={renameProfile}
      deleteProfile={deleteProfile}
      onDisconnect={() => {
        setDevice(null);
        setProfiles([{ id: "default", name: "Default", buttons: [] }]);
        setActiveProfileId("default");
      }}
    />
  );
}
