import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { DeviceInfo } from "@/App";

interface WelcomeViewProps {
  onConnected: (device: DeviceInfo) => void;
}

export default function WelcomeView({ onConnected }: WelcomeViewProps) {
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<DeviceInfo[] | null>(null);
  const [lastFailed, setLastFailed] = useState<DeviceInfo | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (found && found.length > 0) {
      listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [found]);

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    setFound(null);
    setLastFailed(null);
    try {
      const devices = await invoke<DeviceInfo[]>("scan_devices");
      setFound(devices);
    } catch (e) {
      setError(`Scan failed: ${e}`);
    } finally {
      setScanning(false);
    }
  };

  const handleConnect = async (d: DeviceInfo, force = false) => {
    setConnecting(d.port);
    setError(null);
    setLastFailed(null);
    try {
      await invoke("connect_device", { port: d.port, deviceType: d.deviceType, force });
      onConnected(d);
    } catch (e) {
      const msg = `${e}`;
      if (msg === "NO_PONG") {
        setError(`No DeckCraft firmware detected on ${d.port}. The device may not respond.`);
        setLastFailed(d);
      } else {
        setError(msg);
      }
      setConnecting(null);
    }
  };

  return (
    <div className="flex h-dvh items-center justify-center bg-background p-8">
      <Card className="flex max-h-full w-full max-w-md flex-col overflow-hidden">
        <div className="flex flex-col items-center gap-5 px-8 pt-8 pb-4 text-center">
          <img src="/deckcraft.svg" alt="" className="size-14 shrink-0" />

          <div>
            <h1 className="text-xl font-bold">DeckCraft</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect your programmable board to start building your custom Stream Deck.
            </p>
          </div>

          {!found && !scanning && !error && (
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

          {error && (
            <div className="flex w-full flex-col items-center gap-3">
              <p className="text-center text-sm text-destructive">{error}</p>
              {lastFailed && (
                <div className="flex w-full gap-2">
                  <Button variant="outline" onClick={handleScan} className="flex-1">
                    Rescan
                  </Button>
                  <Button onClick={() => handleConnect(lastFailed, true)} className="flex-1">
                    Connect anyway
                  </Button>
                </div>
              )}
              {!lastFailed && (
                <Button variant="outline" onClick={handleScan} className="w-full">
                  Retry scan
                </Button>
              )}
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
        </div>

        {found && found.length > 0 && (
          <>
            <div className="px-8 pb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {found.length} device{found.length > 1 ? "s" : ""} found
              </p>
            </div>

            <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-8 pb-6">
              <div className="space-y-1.5">
                {found.map((device) => {
                  const busy = connecting === device.port;
                  return (
                    <button
                      key={device.port}
                      onClick={() => !busy && handleConnect(device)}
                      disabled={busy}
                      className="group flex w-full items-center gap-3 rounded-lg border border-border bg-secondary p-3 text-left transition-all hover:border-primary hover:bg-primary/5 disabled:opacity-50"
                    >
                      <div className={`size-2 shrink-0 rounded-full ${busy ? "bg-primary animate-pulse" : "bg-success"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{device.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {device.port} &middot; {device.deviceType.toUpperCase()}
                          {busy ? " — connecting..." : ""}
                        </p>
                      </div>
                      <svg className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
