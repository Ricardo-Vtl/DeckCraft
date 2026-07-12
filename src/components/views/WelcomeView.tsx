import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { DeviceInfo } from "@/App";

interface WelcomeViewProps {
  onConnected: (device: DeviceInfo) => void;
}

const MOCK_DEVICES: DeviceInfo[] = [
  { name: "Arduino Uno", port: "COM3", type: "serial" },
  { name: "Arduino Leonardo", port: "COM5", type: "hid" },
];

export default function WelcomeView({ onConnected }: WelcomeViewProps) {
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<DeviceInfo[] | null>(null);

  const handleScan = () => {
    setScanning(true);
    setFound(null);
    // ponytail: mock scan delay; replace with Rust IPC when serial backend is ready
    setTimeout(() => {
      setScanning(false);
      setFound(MOCK_DEVICES);
    }, 1500);
  };

  return (
    <div className="flex h-dvh items-center justify-center bg-background p-8">
      <Card className="w-full max-w-md p-8">
        <div className="flex flex-col items-center gap-6 text-center">
          <img src="/deckcraft.svg" alt="" className="size-16" />

          <div>
            <h1 className="text-xl font-bold">DeckCraft</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect your programmable board to start building your custom Stream Deck.
            </p>
          </div>

          {!found && !scanning && (
            <Button onClick={handleScan} className="w-full">
              Scan for boards
            </Button>
          )}

          {scanning && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Scanning Serial & HID ports...</p>
            </div>
          )}

          {found && found.length === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                No boards found. Make sure your device is connected and try again.
              </p>
              <Button variant="outline" onClick={handleScan} className="w-full">
                Rescan
              </Button>
            </div>
          )}

          {found && found.length > 0 && (
            <div className="w-full space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {found.length} board{found.length > 1 ? "s" : ""} found
              </p>
              {found.map((device) => (
                <button
                  key={device.port}
                  onClick={() => onConnected(device)}
                  className="group flex w-full items-center gap-3 rounded-lg border border-border bg-secondary p-3 text-left transition-all hover:border-primary hover:bg-primary/5"
                >
                  <div className="size-2 shrink-0 rounded-full bg-success" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{device.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {device.port} &middot; {device.type.toUpperCase()}
                    </p>
                  </div>
                  <svg
                    className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
