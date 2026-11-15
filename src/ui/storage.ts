import { BACKUP_KEY, SAVE_KEY } from '../logic/save';

export function readSave(): string | null {
  try {
    return localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
}

export function writeSave(raw: string): void {
  try {
    localStorage.setItem(SAVE_KEY, raw);
  } catch {
    /* 저장 공간이 막힌 환경에서는 메모리로만 진행 */
  }
}

export function writeBackup(raw: string): void {
  try {
    localStorage.setItem(BACKUP_KEY, raw);
  } catch {
    /* 무시 */
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* 무시 */
  }
}
