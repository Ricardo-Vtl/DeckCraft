import { useState } from "react";
import WelcomeView from "@/components/views/WelcomeView";
import Dashboard from "@/components/Dashboard";

export interface AppInfo {
  name: string;
  path: string;
}

export interface ButtonConfig {
  id: string;
  label: string;
  action:
    | { type: "key"; keys: string[] }
    | { type: "executable"; name: string; path: string; icon?: string }
    | { type: "launch"; path: string };
}

export interface DeviceInfo {
  name: string;
  port: string;
  type: "serial" | "hid";
}

export default function App() {
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [buttons, setButtons] = useState<ButtonConfig[]>([]);

  if (!device) {
    return <WelcomeView onConnected={setDevice} />;
  }

  return (
    <Dashboard
      device={device}
      buttons={buttons}
      setButtons={setButtons}
      onDisconnect={() => {
        setDevice(null);
        setButtons([]);
      }}
    />
  );
}
