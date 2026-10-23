export interface WordPair {
  id: string;
  civilianWord: string;
  undercoverWord: string;
  createdAt: number;
  updatedAt: number;
}

export interface WordGroup {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  pairs: WordPair[];
}

export interface RawPair {
  civilianWord: string;
  undercoverWord: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string; field?: string };
