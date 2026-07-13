import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import manifest from '../../prototype.manifest.json';

export type ProtoPatch = { key: string; before: unknown; after: unknown };

type ProtoContextValue = {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
  exportPatches: () => ProtoPatch[];
};

const ProtoContext = createContext<ProtoContextValue | null>(null);

function flattenDefaults(pages: typeof manifest.pages): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  for (const page of pages) {
    for (const binding of page.bindings) {
      map[binding.key] = binding.default;
    }
  }
  return map;
}

export function ProtoProvider({ children }: { children: ReactNode }) {
  const defaults = useMemo(() => flattenDefaults(manifest.pages), []);
  const [values, setValues] = useState<Record<string, unknown>>(defaults);

  const api = useMemo<ProtoContextValue>(
    () => ({
      get: (key: string) => values[key],
      set: (key: string, value: unknown) =>
        setValues((prev) => ({ ...prev, [key]: value })),
      exportPatches: () =>
        Object.keys(values)
          .filter(
            (key) =>
              JSON.stringify(values[key]) !== JSON.stringify(defaults[key]),
          )
          .map((key) => ({
            key,
            before: defaults[key],
            after: values[key],
          })),
    }),
    [values, defaults],
  );

  return (
    <ProtoContext.Provider value={api}>{children}</ProtoContext.Provider>
  );
}

export function useProto(): ProtoContextValue {
  const ctx = useContext(ProtoContext);
  if (!ctx) {
    throw new Error('useProto must be used within ProtoProvider');
  }
  return ctx;
}

/** 开发时在控制台调用：copy(JSON.stringify(useProto().exportPatches())) */
export function logProtoPatches(getExport: () => ProtoPatch[]) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info('[Proto Edit] patches:', getExport());
  }
}
