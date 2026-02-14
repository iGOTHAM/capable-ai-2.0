import type { SetupData } from "@/app/(setup)/setup/page";

const STORAGE_KEY = "capable_setup";

export function loadSetupState(): {
  step: number;
  data: Partial<SetupData>;
} | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.step !== "number" || !parsed.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSetupState(step: number, data: SetupData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, data }));
  } catch {
    // localStorage might be full or unavailable — ignore
  }
}

export function clearSetupStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
