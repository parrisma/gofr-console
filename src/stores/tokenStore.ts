// Token CRUD store for JWT tokens.
// Tokens are persisted via /api/users (separate from config).

import type { JwtToken } from '../types/uiConfig';

class TokenStore {
  private _tokens: JwtToken[] = [];
  private _listeners: Set<() => void> = new Set();
  private _saveDebounce: ReturnType<typeof setTimeout> | null = null;

  get tokens(): JwtToken[] {
    return this._tokens;
  }

  setTokens(tokens: JwtToken[]): void {
    this._tokens = tokens;
    this.notify();
  }

  addToken(token: JwtToken): void {
    this._tokens.push(token);
    this.save();
    this.notify();
  }

  updateToken(index: number, token: JwtToken): void {
    const safeIndex = Math.floor(index);
    if (safeIndex >= 0 && safeIndex < this._tokens.length) {
      this._tokens.splice(safeIndex, 1, token);
      this.save();
      this.notify();
    }
  }

  deleteToken(index: number): void {
    const safeIndex = Math.floor(index);
    if (safeIndex >= 0 && safeIndex < this._tokens.length) {
      this._tokens.splice(safeIndex, 1);
      this.save();
      this.notify();
    }
  }

  // Persist to /api/users (debounced)
  private save(): void {
    if (this._saveDebounce) {
      clearTimeout(this._saveDebounce);
    }
    this._saveDebounce = setTimeout(() => {
      this.saveImmediate();
    }, 500);
  }

  private async saveImmediate(): Promise<void> {
    try {
      const response = await fetch('/api/users');
      if (!response.ok) return;
      const data = await response.json();
      data.tokens = this._tokens;
      await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch {
      console.error('Failed to save tokens');
    }
  }

  subscribe(listener: () => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private notify(): void {
    this._listeners.forEach(listener => listener());
  }
}

// Singleton instance
export const tokenStore = new TokenStore();
