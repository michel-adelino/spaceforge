import { Command } from './commands';

export interface HistoryEntry {
  label: string;
  state: 'done' | 'undone';
}

export class HistoryManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private readonly listeners = new Set<() => void>();
  private _version = 0;

  constructor(private readonly limit = 200) {}

  readonly subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };
  readonly getVersion = (): number => this._version;

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }
  get entries(): HistoryEntry[] {
    return [
      ...this.undoStack.map((c) => ({ label: c.label, state: 'done' as const })),
      ...[...this.redoStack].reverse().map((c) => ({ label: c.label, state: 'undone' as const })),
    ];
  }

  /** Apply a command and remember it. */
  execute(cmd: Command): void {
    cmd.execute();
    this.push(cmd);
  }

  /** Remember a command whose effect has already been applied (e.g. after a drag). */
  record(cmd: Command): void {
    this.push(cmd);
  }

  undo(): boolean {
    const cmd = this.undoStack.pop();
    if (!cmd) return false;
    cmd.undo();
    this.redoStack.push(cmd);
    this.notify();
    return true;
  }

  redo(): boolean {
    const cmd = this.redoStack.pop();
    if (!cmd) return false;
    cmd.execute();
    this.undoStack.push(cmd);
    this.notify();
    return true;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  private push(cmd: Command): void {
    const top = this.undoStack[this.undoStack.length - 1];
    if (!(top && top.merge?.(cmd))) {
      this.undoStack.push(cmd);
      if (this.undoStack.length > this.limit) this.undoStack.shift();
    }
    this.redoStack = [];
    this.notify();
  }

  private notify(): void {
    this._version++;
    this.listeners.forEach((l) => l());
  }
}
