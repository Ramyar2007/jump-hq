export type Lang = { code: string; name: string; en: string; rtl: boolean };
export const LANGS: Lang[];
export const DICT: Record<string, Record<string, string>>;
export function setLang(code: string): void;
export function getLang(): string;
export function t(s: string): string;
