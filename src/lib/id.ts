export const newId = (): string => crypto.randomUUID();
export const nowIso = (): string => new Date().toISOString();
export const todayIso = (): string => new Date().toISOString().slice(0, 10);
