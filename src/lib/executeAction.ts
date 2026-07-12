import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { ButtonConfig, Profile } from "@/App";

export type NavigateFn = (profileId: string) => void;

export async function executeAction(
  action: ButtonConfig["action"],
  profiles: Profile[],
  activeProfileId: string,
  navigate: NavigateFn,
): Promise<void> {
  switch (action.type) {
    case "key":
      if (action.keys.length > 0) {
        await invoke("send_keys", { combo: action.keys.join("+") });
      }
      break;
    case "executable":
    case "launch":
      if (action.path) {
        await invoke("shell_open", { path: action.path });
      }
      break;
    case "url":
      if (action.url) {
        await openUrl(action.url);
      }
      break;
    case "text":
      if (action.text) {
        await invoke("type_text", { text: action.text });
      }
      break;
    case "navigate": {
      const targetId = action.target === "profile"
        ? (action.profile ?? activeProfileId)
        : action.target === "next"
          ? nextProfileId(profiles, activeProfileId)
          : prevProfileId(profiles, activeProfileId);
      if (targetId && targetId !== activeProfileId) {
        navigate(targetId);
      }
      break;
    }
  }
}

function nextProfileId(profiles: Profile[], currentId: string): string | null {
  const idx = profiles.findIndex((p) => p.id === currentId);
  if (idx === -1 || idx >= profiles.length - 1) return null;
  return profiles[idx + 1].id;
}

function prevProfileId(profiles: Profile[], currentId: string): string | null {
  const idx = profiles.findIndex((p) => p.id === currentId);
  if (idx <= 0) return null;
  return profiles[idx - 1].id;
}
