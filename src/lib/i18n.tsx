import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Language =
  | "English"
  | "Spanish"
  | "French"
  | "Mandarin"
  | "Arabic"
  | "Portuguese"
  | "Hindi";

const TRANSLATE_URL = "https://nebulalearn-production.up.railway.app/translate";

// Cache: language -> { english_string -> translated_string }
const dictCache: Partial<Record<Language, Record<string, string>>> = {
  English: {},
};
const inflightDict: Partial<Record<Language, Promise<Record<string, string>>>> = {};

// Cache for arbitrary string-array translations (e.g. key-takeaway sentences).
// Key: `${language}::${joined-strings}`
const arrayCache = new Map<string, string[]>();
const inflightArray = new Map<string, Promise<string[]>>();

/**
 * Send an array of strings to the /translate endpoint and return the translated
 * array (same length, same order). For English, the input is returned as-is.
 *
 * The endpoint is the same one used to translate lecture content — content is
 * sent as a JSON-encoded string. The response shape mirrors that endpoint:
 * `{ translated: "<json string or array>" }`.
 */
export async function translateStrings(
  language: Language,
  strings: string[],
): Promise<string[]> {
  if (language === "English" || strings.length === 0) return strings;
  const cacheKey = `${language}::${strings.join("\u0001")}`;
  const cached = arrayCache.get(cacheKey);
  if (cached) return cached;
  const existing = inflightArray.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    const res = await fetch(TRANSLATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: JSON.stringify(strings),
        language,
      }),
    });
    if (!res.ok) throw new Error(`Translate request failed (${res.status})`);
    const payload = await res.json();
    const raw = payload?.translated ?? payload?.data ?? payload;
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr) || arr.length !== strings.length) {
      throw new Error("Malformed translation response");
    }
    const result = arr.map((s, i) => (typeof s === "string" ? s : strings[i]));
    arrayCache.set(cacheKey, result);
    return result;
  })();
  inflightArray.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inflightArray.delete(cacheKey);
  }
}

interface LanguageContextValue {
  language: Language;
  /** Translate a known UI string. Falls back to the English source if missing. */
  t: (en: string) => string;
  /** True once the dictionary for the active language is loaded. */
  ready: boolean;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: "English",
  t: (s) => s,
  ready: true,
});

export const useT = () => useContext(LanguageContext);

interface ProviderProps {
  language: Language;
  /** All English UI strings used across the app — translated together on switch. */
  dictionary: readonly string[];
  children: ReactNode;
}

export const LanguageProvider = ({ language, dictionary, children }: ProviderProps) => {
  const dictKey = useMemo(() => dictionary.join("\u0001"), [dictionary]);
  const [, force] = useState(0);
  const [ready, setReady] = useState(language === "English" || !!dictCache[language]);

  useEffect(() => {
    if (language === "English") {
      setReady(true);
      return;
    }
    if (dictCache[language]) {
      setReady(true);
      return;
    }
    setReady(false);
    let cancelled = false;
    if (!inflightDict[language]) {
      inflightDict[language] = translateStrings(language, [...dictionary])
        .then((translated) => {
          const map: Record<string, string> = {};
          dictionary.forEach((en, i) => {
            map[en] = translated[i] ?? en;
          });
          dictCache[language] = map;
          return map;
        })
        .catch((err) => {
          console.error("[i18n] dictionary translation failed", err);
          dictCache[language] = {}; // fall back to English everywhere
          return {};
        })
        .finally(() => {
          delete inflightDict[language];
        });
    }
    inflightDict[language]!.then(() => {
      if (cancelled) return;
      setReady(true);
      force((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [language, dictKey, dictionary]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      ready,
      t: (en: string) => dictCache[language]?.[en] ?? en,
    }),
    [language, ready],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};
