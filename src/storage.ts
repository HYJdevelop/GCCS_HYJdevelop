import { createInitialState, normalizeState, STORAGE_KEY } from './data';
import type { AppState } from './types';

export function loadLocalState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? normalizeState(JSON.parse(saved)) : createInitialState();
  } catch {
    return createInitialState();
  }
}

export function saveLocalState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}