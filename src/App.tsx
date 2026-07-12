import { useState, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import WelcomeView from "@/components/views/WelcomeView";
import Dashboard from "@/components/Dashboard";
import { executeAction } from "@/lib/executeAction";
import { message } from "@tauri-apps/plugin-dialog";

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
  physicalId?: number;
  action:
    | { type: "key"; keys: string[] }
    | { type: "executable"; name: string; path: string; icon?: string }
    | { type: "launch"; path: string }
    | { type: "url"; url: string }
    | { type: "text"; text: string }
    | { type: "navigate"; target: "next" | "prev" | "profile"; profile?: string }
    | { type: "audio"; path: string; device?: string };
}

export interface DeviceInfo {
  name: string;
  port: string;
  deviceType: "serial" | "hid";
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

  useEffect(() => {
    if (!device) return;
    let unlisten: (() => void) | undefined;
    listen("device-disconnected", () => { setDevice(null); }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, [device]);

  // Execute action when physical button is pressed
  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;
  const activeProfileIdRef = useRef(activeProfileId);
  activeProfileIdRef.current = activeProfileId;

  useEffect(() => {
    if (!device) return;
    let unsub: (() => void) | undefined;
    listen<{ id: number }>("button-down", (event) => {
      const p = profilesRef.current.find((p) => p.id === activeProfileIdRef.current);
      if (!p) return;
      const btn = p.buttons.find((b) => b.physicalId === event.payload.id);
      if (!btn) return;
      executeAction(btn.action, profilesRef.current, activeProfileIdRef.current, setActiveProfileId).catch((err) => {
        message(`${err}`, { title: "Action failed", kind: "error" });
      });
    }).then((fn) => { unsub = fn; });
    return () => { unsub?.(); };
  }, [device]);

  const handleDisconnect = () => {
    invoke("disconnect_device").catch(() => {});
    setDevice(null);
    setProfiles([{ id: "default", name: "Default", buttons: [] }]);
    setActiveProfileId("default");
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
      onDisconnect={handleDisconnect}
    />
  );
}
