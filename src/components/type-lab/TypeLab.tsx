"use client";

import { RotateCcw, Type, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/editorial/Button";
import { SegmentedControl } from "@/components/editorial/SegmentedControl";
import { SingleSelectMenu } from "@/components/editorial/SingleSelectMenu";
import styles from "./TypeLab.module.css";

type SerifId =
  | "source-serif"
  | "instrument-serif"
  | "newsreader"
  | "eb-garamond"
  | "cormorant-garamond"
  | "signifier"
  | "tiempos-fine"
  | "tiempos-headline"
  | "martina"
  | "suisse-works"
  | "lyon";
type SerifCut = "light" | "regular" | "medium";
type SansId =
  | "inter"
  | "instrument-sans"
  | "work-sans"
  | "public-sans"
  | "source-sans-3"
  | "archivo"
  | "manrope"
  | "suisse-intl"
  | "national"
  | "metric"
  | "arbeit"
  | "centra"
  | "diatype";
type PresetId =
  | "custom"
  | "current"
  | "favorite"
  | "closest-free"
  | "low-risk-free"
  | "civic-free"
  | "editorial"
  | "fine-press"
  | "institutional"
  | "swiss";
type OpenMenu = "preset" | "serif" | "sans" | null;
type FontAccess = "free" | "paid";
type FontFormat = "woff2" | "truetype";

interface TypeLabSelection {
  serif: SerifId;
  cut: SerifCut;
  sans: SansId;
  serifSize: number;
  sansSize: number;
  lineHeight: number;
}

type TypefaceSelection = Pick<TypeLabSelection, "serif" | "cut" | "sans">;

interface FaceSource {
  normal: string;
  italic?: string;
  local?: boolean;
  raw?: boolean;
  format?: FontFormat;
  weight?: string;
}

interface SansSource {
  normal: string;
  italic?: string;
  weight: string;
  local?: boolean;
  raw?: boolean;
  format?: FontFormat;
}

const STORAGE_KEY = "civica-type-lab/v1";
const MIN_FONT_SIZE = 85;
const MAX_FONT_SIZE = 120;
const MIN_LINE_HEIGHT = 85;
const MAX_LINE_HEIGHT = 130;
const LEADING_TOKENS = [
  "--leading-none",
  "--leading-tight",
  "--leading-snug",
  "--leading-normal",
  "--leading-relaxed",
  "--leading-loose",
] as const;
const DEFAULT_SELECTION: TypeLabSelection = {
  serif: "source-serif",
  cut: "regular",
  sans: "inter",
  serifSize: 100,
  sansSize: 100,
  lineHeight: 100,
};

const SERIF_ITEMS = [
  {
    value: "source-serif",
    label: "Free · Source Serif 4 · current",
    access: "free",
  },
  {
    value: "cormorant-garamond",
    label: "Free · Cormorant Garamond · Lyon-like",
    access: "free",
  },
  {
    value: "instrument-serif",
    label: "Free · Instrument Serif · Signifier-like",
    access: "free",
  },
  {
    value: "newsreader",
    label: "Free · Newsreader · Tiempos-like",
    access: "free",
  },
  {
    value: "eb-garamond",
    label: "Free · EB Garamond · Martina-like",
    access: "free",
  },
  { value: "signifier", label: "Paid · Signifier · trial", access: "paid" },
  {
    value: "tiempos-fine",
    label: "Paid · Tiempos Fine · trial",
    access: "paid",
  },
  {
    value: "tiempos-headline",
    label: "Paid · Tiempos Headline · trial",
    access: "paid",
  },
  {
    value: "martina",
    label: "Paid · Martina Plantijn · trial",
    access: "paid",
  },
  {
    value: "suisse-works",
    label: "Paid · Suisse Works · trial",
    access: "paid",
  },
  {
    value: "lyon",
    label: "Paid · Lyon Display · trial installed",
    access: "paid",
  },
] satisfies Array<{ value: SerifId; label: string; access: FontAccess }>;

const SANS_ITEMS = [
  { value: "inter", label: "Free · Inter · current", access: "free" },
  {
    value: "instrument-sans",
    label: "Free · Instrument Sans · Diatype-like",
    access: "free",
  },
  {
    value: "work-sans",
    label: "Free · Work Sans · Suisse-like",
    access: "free",
  },
  {
    value: "public-sans",
    label: "Free · Public Sans · National-like",
    access: "free",
  },
  {
    value: "source-sans-3",
    label: "Free · Source Sans 3 · Metric-like",
    access: "free",
  },
  {
    value: "archivo",
    label: "Free · Archivo · Arbeit-like",
    access: "free",
  },
  {
    value: "manrope",
    label: "Free · Manrope · Centra-like",
    access: "free",
  },
  {
    value: "suisse-intl",
    label: "Paid · Suisse Int’l · trial",
    access: "paid",
  },
  { value: "national", label: "Paid · National · trial", access: "paid" },
  { value: "metric", label: "Paid · Metric · trial", access: "paid" },
  {
    value: "arbeit",
    label: "Paid · Arbeit Pro · installed",
    access: "paid",
  },
  {
    value: "centra",
    label: "Paid · Centra No2 · trial installed",
    access: "paid",
  },
  {
    value: "diatype",
    label: "Paid · ABC Diatype · trial installed",
    access: "paid",
  },
] satisfies Array<{ value: SansId; label: string; access: FontAccess }>;

const CUT_ITEMS = [
  { value: "light", label: "Light" },
  { value: "regular", label: "Regular" },
  { value: "medium", label: "Medium" },
] satisfies Array<{ value: SerifCut; label: string }>;

const PRESETS: Record<Exclude<PresetId, "custom">, TypefaceSelection> = {
  current: { serif: "source-serif", cut: "regular", sans: "inter" },
  favorite: { serif: "lyon", cut: "regular", sans: "diatype" },
  "closest-free": {
    serif: "cormorant-garamond",
    cut: "regular",
    sans: "instrument-sans",
  },
  "low-risk-free": {
    serif: "source-serif",
    cut: "regular",
    sans: "instrument-sans",
  },
  "civic-free": {
    serif: "newsreader",
    cut: "regular",
    sans: "public-sans",
  },
  editorial: { serif: "signifier", cut: "light", sans: "suisse-intl" },
  "fine-press": { serif: "tiempos-fine", cut: "light", sans: "national" },
  institutional: { serif: "martina", cut: "light", sans: "arbeit" },
  swiss: { serif: "suisse-works", cut: "light", sans: "suisse-intl" },
};

const PRESET_ITEMS = [
  { value: "current", label: "Current · Free · Source Serif + Inter" },
  { value: "favorite", label: "Favorite · Paid · Lyon + Diatype" },
  {
    value: "closest-free",
    label: "Closest free · Free · Cormorant + Instrument",
  },
  {
    value: "low-risk-free",
    label: "Low-risk free · Free · Source Serif + Instrument",
  },
  {
    value: "civic-free",
    label: "Civic free · Free · Newsreader + Public Sans",
  },
  {
    value: "editorial",
    label: "Editorial · Paid · Signifier + Suisse",
  },
  {
    value: "fine-press",
    label: "Fine press · Paid · Tiempos + National",
  },
  {
    value: "institutional",
    label: "Institutional · Paid · Martina + Arbeit",
  },
  {
    value: "swiss",
    label: "Swiss · Paid · Suisse Works + Suisse Int’l",
  },
] satisfies Array<{
  value: Exclude<PresetId, "custom">;
  label: string;
}>;

const REMOTE_SERIFS: Exclude<SerifId, "source-serif" | "lyon">[] = [
  "signifier",
  "tiempos-fine",
  "tiempos-headline",
  "martina",
  "suisse-works",
];

type OpenSerifId =
  | "instrument-serif"
  | "newsreader"
  | "eb-garamond"
  | "cormorant-garamond";

const OPEN_SERIFS: OpenSerifId[] = [
  "instrument-serif",
  "newsreader",
  "eb-garamond",
  "cormorant-garamond",
];

function isOpenSerif(serif: SerifId): serif is OpenSerifId {
  return OPEN_SERIFS.includes(serif as OpenSerifId);
}

function openSerifSource(
  serif: OpenSerifId,
  cut: SerifCut,
): FaceSource {
  const weight =
    serif === "instrument-serif"
      ? "400"
      : serif === "eb-garamond" && cut === "light"
        ? "400"
        : { light: "300", regular: "400", medium: "500" }[cut];

  const files: Record<
    OpenSerifId,
    Pick<FaceSource, "normal" | "italic">
  > = {
    "instrument-serif": {
      normal: "open-instrument-serif-regular",
      italic: "open-instrument-serif-italic",
    },
    newsreader: {
      normal: "open-newsreader-variable",
      italic: "open-newsreader-italic-variable",
    },
    "eb-garamond": {
      normal: "open-eb-garamond-variable",
      italic: "open-eb-garamond-italic-variable",
    },
    "cormorant-garamond": {
      normal: "open-cormorant-garamond-variable",
      italic: "open-cormorant-garamond-italic-variable",
    },
  };

  return { ...files[serif], format: "truetype", weight };
}

function remoteSerifSource(serif: SerifId, cut: SerifCut): FaceSource | null {
  if (!REMOTE_SERIFS.includes(serif as (typeof REMOTE_SERIFS)[number])) {
    return null;
  }

  if (serif === "suisse-works") {
    const suisseCut = cut === "light" ? "book" : cut;
    return {
      normal: `suisse-works-${suisseCut}`,
      italic: cut === "medium" ? undefined : `suisse-works-${suisseCut}-italic`,
    };
  }

  if (serif === "martina" && cut === "regular") {
    return { normal: "martina-regular", italic: "martina-light-italic" };
  }

  return {
    normal: `${serif}-${cut}`,
    italic: `${serif}-${cut}-italic`,
  };
}

function lyonSource(cut: SerifCut): FaceSource {
  const titleCut = cut.charAt(0).toUpperCase() + cut.slice(1);
  return {
    normal: `LyonDisplayTrial-${titleCut}`,
    italic: `LyonDisplayTrial-${titleCut}Italic`,
    local: true,
  };
}

type OpenSansId =
  | "instrument-sans"
  | "work-sans"
  | "public-sans"
  | "source-sans-3"
  | "archivo"
  | "manrope";

const OPEN_SANS: OpenSansId[] = [
  "instrument-sans",
  "work-sans",
  "public-sans",
  "source-sans-3",
  "archivo",
  "manrope",
];

function isOpenSans(sans: SansId): sans is OpenSansId {
  return OPEN_SANS.includes(sans as OpenSansId);
}

function openSansSources(sans: OpenSansId): SansSource[] {
  const files: Record<
    OpenSansId,
    Pick<SansSource, "normal" | "italic">
  > = {
    "instrument-sans": {
      normal: "open-instrument-sans-variable",
      italic: "open-instrument-sans-italic-variable",
    },
    "work-sans": {
      normal: "open-work-sans-variable",
      italic: "open-work-sans-italic-variable",
    },
    "public-sans": {
      normal: "open-public-sans-variable",
      italic: "open-public-sans-italic-variable",
    },
    "source-sans-3": {
      normal: "open-source-sans-3-variable",
      italic: "open-source-sans-3-italic-variable",
    },
    archivo: {
      normal: "open-archivo-variable",
      italic: "open-archivo-italic-variable",
    },
    manrope: {
      normal: "open-manrope-variable",
    },
  };

  return ["400", "500", "600"].map((weight) => ({
    ...files[sans],
    weight,
    format: "truetype",
  }));
}

function sansSources(sans: SansId): SansSource[] {
  if (sans === "inter") return [];
  if (isOpenSans(sans)) return openSansSources(sans);

  if (sans === "diatype") {
    return [
      {
        normal:
          "ABCDiatypeTrial-Regular|ABC Diatype Trial Regular|ABC Diatype Trial",
        italic:
          "ABCDiatypeTrial-RegularItalic|ABC Diatype Trial Regular Italic",
        weight: "400",
        local: true,
      },
      {
        normal: "ABCDiatypeTrial-Medium|ABC Diatype Trial Medium",
        italic: "ABCDiatypeTrial-MediumItalic|ABC Diatype Trial Medium Italic",
        weight: "500",
        local: true,
      },
      {
        normal: "ABCDiatypeTrial-Bold|ABC Diatype Trial Bold|ABC Diatype Trial",
        italic: "ABCDiatypeTrial-BoldItalic|ABC Diatype Trial Bold Italic",
        weight: "600",
        local: true,
      },
    ];
  }

  if (sans === "arbeit") {
    return [
      {
        normal: "ArbeitPro-Regular|Arbeit Pro Regular|Arbeit Pro",
        italic: "ArbeitPro-RegularItalic|Arbeit Pro Regular Italic",
        weight: "400",
        local: true,
      },
      {
        normal: "ArbeitPro-Medium|Arbeit Pro Medium",
        italic: "ArbeitPro-MediumItalic|Arbeit Pro Medium Italic",
        weight: "500",
        local: true,
      },
      {
        normal: "ArbeitPro-Semi-Bold|Arbeit Pro Semi-Bold",
        italic: "ArbeitPro-Semi-BoldItalic|Arbeit Pro Semi-Bold Italic",
        weight: "600",
        local: true,
      },
    ];
  }

  if (sans === "centra") {
    return [
      {
        normal: "CentraNo2-Book|Centra No2",
        italic: "CentraNo2-BookItalic|Centra No2 Italic",
        weight: "400",
        local: true,
      },
      {
        normal: "CentraNo2-Medium|Centra No2 Medium",
        italic: "CentraNo2-MediumItalic|Centra No2 Medium Italic",
        weight: "500",
        local: true,
      },
      {
        normal: "CentraNo2-Bold|Centra No2 Bold",
        italic: "CentraNo2-BoldItalic|Centra No2 Bold Italic",
        weight: "600",
        local: true,
      },
    ];
  }

  const cuts = [
    { cut: "regular", weight: "400" },
    { cut: "medium", weight: "500" },
    { cut: "semibold", weight: "600" },
  ];

  return cuts.map(({ cut, weight }) => ({
    normal: `${sans}-${cut}`,
    italic: `${sans}-${cut}-italic`,
    weight,
  }));
}

function faceSource(
  source: string,
  local = false,
  raw = false,
  format: FontFormat = "woff2",
): string {
  if (raw) return source;

  if (local) {
    return source
      .split("|")
      .map((candidate) => `local("${candidate}")`)
      .join(", ");
  }

  return `url("/api/type-lab-font/${source}") format("${format}")`;
}

function sizedFaceDescriptors(
  style: "normal" | "italic",
  weight: string,
  size: number,
): FontFaceDescriptors {
  return {
    style,
    weight,
    sizeAdjust: `${size}%`,
  } as FontFaceDescriptors;
}

function currentWebFontSource(
  family: "Source Serif 4" | "Inter",
  style: "normal" | "italic",
): string | null {
  const matches: Array<{ src: string; unicodeRange: string; base: string }> =
    [];

  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }

    for (const rule of Array.from(rules)) {
      if (rule.type !== CSSRule.FONT_FACE_RULE) continue;
      const fontRule = rule as CSSFontFaceRule;
      const ruleFamily = fontRule.style
        .getPropertyValue("font-family")
        .trim()
        .replace(/^['"]|['"]$/g, "");
      const ruleStyle = fontRule.style.getPropertyValue("font-style").trim();

      if (ruleFamily !== family || ruleStyle !== style) continue;

      matches.push({
        src: fontRule.style.getPropertyValue("src"),
        unicodeRange: fontRule.style.getPropertyValue("unicode-range"),
        base: sheet.href ?? document.baseURI,
      });
    }
  }

  const match =
    matches.find(({ unicodeRange }) => unicodeRange.includes("U+??")) ??
    matches.at(-1);
  const url = match?.src.match(/url\(["']?([^"')]+)["']?\)/)?.[1];

  if (!match || !url) return null;
  return `url("${new URL(url, match.base).href}") format("woff2")`;
}

function currentSerifSource(): FaceSource | null {
  const normal = currentWebFontSource("Source Serif 4", "normal");
  const italic = currentWebFontSource("Source Serif 4", "italic");
  return normal ? { normal, italic: italic ?? undefined, raw: true } : null;
}

function currentSansSources(): SansSource[] {
  const normal = currentWebFontSource("Inter", "normal");
  return normal ? [{ normal, weight: "400 600", raw: true }] : [];
}

function presetFor(selection: TypeLabSelection): PresetId {
  for (const [preset, value] of Object.entries(PRESETS)) {
    if (
      value.serif === selection.serif &&
      value.cut === selection.cut &&
      value.sans === selection.sans
    ) {
      return preset as Exclude<PresetId, "custom">;
    }
  }
  return "custom";
}

function normalizeSelection(value: unknown): TypeLabSelection | null {
  if (!value || typeof value !== "object") return null;
  const selection = value as Partial<TypeLabSelection>;
  const validTypeface =
    SERIF_ITEMS.some((item) => item.value === selection.serif) &&
    CUT_ITEMS.some((item) => item.value === selection.cut) &&
    SANS_ITEMS.some((item) => item.value === selection.sans);

  if (!validTypeface) return null;

  const normalizeSize = (value: unknown) =>
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= MIN_FONT_SIZE &&
    value <= MAX_FONT_SIZE
      ? Math.round(value)
      : 100;

  return {
    serif: selection.serif as SerifId,
    cut: selection.cut as SerifCut,
    sans: selection.sans as SansId,
    serifSize: normalizeSize(selection.serifSize),
    sansSize: normalizeSize(selection.sansSize),
    lineHeight:
      typeof selection.lineHeight === "number" &&
      Number.isFinite(selection.lineHeight) &&
      selection.lineHeight >= MIN_LINE_HEIGHT &&
      selection.lineHeight <= MAX_LINE_HEIGHT
        ? Math.round(selection.lineHeight)
        : 100,
  };
}

function PercentageControl({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className={styles.sizeControl}>
      <div className={styles.sizeHeader}>
        <label htmlFor={id}>{label}</label>
        <output className={styles.sizeValue}>{value}%</output>
      </div>
      <input
        id={id}
        className={styles.sizeRange}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        aria-valuetext={`${value}%`}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

export function TypeLab() {
  const [expanded, setExpanded] = useState(false);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [selection, setSelection] =
    useState<TypeLabSelection>(DEFAULT_SELECTION);
  const [ready, setReady] = useState(false);
  const [serifStatus, setSerifStatus] = useState("Current serif");
  const [sansStatus, setSansStatus] = useState("Current sans");
  const [serifError, setSerifError] = useState(false);
  const [sansError, setSansError] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const leadingBaseRef = useRef<Record<
    (typeof LEADING_TOKENS)[number],
    number
  > | null>(null);
  const activePreset = useMemo(() => presetFor(selection), [selection]);
  const presetItems = useMemo(() => {
    const serifAccess = SERIF_ITEMS.find(
      (item) => item.value === selection.serif,
    )?.access;
    const sansAccess = SANS_ITEMS.find(
      (item) => item.value === selection.sans,
    )?.access;
    const customAccess =
      serifAccess === "free" && sansAccess === "free" ? "Free" : "Paid";

    return [
      ...PRESET_ITEMS,
      {
        value: "custom" as const,
        label: `Custom combination · ${customAccess}`,
      },
    ];
  }, [selection.serif, selection.sans]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      const normalized = normalizeSelection(stored);
      if (normalized) setSelection(normalized);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  }, [ready, selection]);

  useEffect(() => {
    const root = document.documentElement;
    const clearLeadingOverrides = () => {
      LEADING_TOKENS.forEach((token) => root.style.removeProperty(token));
    };

    if (!leadingBaseRef.current) {
      clearLeadingOverrides();
      const computed = getComputedStyle(root);
      leadingBaseRef.current = Object.fromEntries(
        LEADING_TOKENS.map((token) => [
          token,
          Number.parseFloat(computed.getPropertyValue(token)),
        ]),
      ) as Record<(typeof LEADING_TOKENS)[number], number>;
    }

    if (selection.lineHeight === 100) {
      clearLeadingOverrides();
      return;
    }

    const scale = selection.lineHeight / 100;
    LEADING_TOKENS.forEach((token) => {
      const base = leadingBaseRef.current?.[token];
      if (base && Number.isFinite(base)) {
        root.style.setProperty(token, String(base * scale));
      }
    });

    return clearLeadingOverrides;
  }, [selection.lineHeight]);

  useEffect(() => {
    if (!expanded) return;

    const dismiss = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };

    document.addEventListener("mousedown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [expanded]);

  useEffect(() => {
    const root = document.documentElement;
    const loadedFaces: FontFace[] = [];
    let cancelled = false;

    if (selection.serif === "source-serif" && selection.serifSize === 100) {
      root.style.removeProperty("--font-heading");
      root.style.removeProperty("--font-serif");
      setSerifStatus("Source Serif 4 ready");
      setSerifError(false);
      return;
    }

    setSerifStatus(
      `Loading ${SERIF_ITEMS.find((item) => item.value === selection.serif)?.label}…`,
    );
    setSerifError(false);

    let source: FaceSource | null;
    if (selection.serif === "source-serif") {
      source = currentSerifSource();
    } else if (selection.serif === "lyon") {
      source = lyonSource(selection.cut);
    } else if (isOpenSerif(selection.serif)) {
      source = openSerifSource(selection.serif, selection.cut);
    } else {
      source = remoteSerifSource(selection.serif, selection.cut);
    }

    if (!source) {
      root.style.removeProperty("--font-heading");
      root.style.removeProperty("--font-serif");
      setSerifError(true);
      setSerifStatus("Current serif source could not be resized");
      return;
    }

    const family = `Civica Type Lab Serif ${selection.serif} ${selection.cut} ${selection.serifSize}`;
    const normal = new FontFace(
      family,
      faceSource(source.normal, source.local, source.raw, source.format),
      sizedFaceDescriptors(
        "normal",
        source.weight ?? "100 900",
        selection.serifSize,
      ),
    );
    const italic = source.italic
      ? new FontFace(
          family,
          faceSource(source.italic, source.local, source.raw, source.format),
          sizedFaceDescriptors(
            "italic",
            source.weight ?? "100 900",
            selection.serifSize,
          ),
        )
      : null;

    void Promise.all([normal.load(), ...(italic ? [italic.load()] : [])])
      .then((faces) => {
        if (cancelled) return;
        faces.forEach((face) => {
          document.fonts.add(face);
          loadedFaces.push(face);
        });
        root.style.setProperty(
          "--font-heading",
          `"${family}", var(--font-source-serif), "Georgia", "Times New Roman", serif`,
        );
        root.style.setProperty("--font-serif", "var(--font-heading)");
        setSerifStatus(
          `${SERIF_ITEMS.find((item) => item.value === selection.serif)?.label} · ${selection.cut}`,
        );
      })
      .catch(() => {
        if (cancelled) return;
        root.style.removeProperty("--font-heading");
        root.style.removeProperty("--font-serif");
        setSerifError(true);
        setSerifStatus(
          selection.serif === "lyon"
            ? "Lyon Display needs to be installed in Font Book first"
            : selection.serif === "source-serif"
              ? "Current serif source could not be resized"
              : isOpenSerif(selection.serif)
                ? "Free serif file is unavailable in local/type-lab-fonts"
              : "Serif trial file is unavailable in Downloads",
        );
      });

    return () => {
      cancelled = true;
      loadedFaces.forEach((face) => document.fonts.delete(face));
    };
  }, [selection.serif, selection.cut, selection.serifSize]);

  useEffect(() => {
    const root = document.documentElement;
    const loadedFaces: FontFace[] = [];
    let cancelled = false;

    const removeBodyOverrides = () => {
      ["--font-body", "--font-body-sans", "--font-sans", "--font-mono"].forEach(
        (property) => root.style.removeProperty(property),
      );
    };

    if (selection.sans === "inter" && selection.sansSize === 100) {
      removeBodyOverrides();
      setSansStatus("Inter ready");
      setSansError(false);
      return;
    }

    setSansStatus(
      `Loading ${SANS_ITEMS.find((item) => item.value === selection.sans)?.label}…`,
    );
    setSansError(false);

    const sources =
      selection.sans === "inter"
        ? currentSansSources()
        : sansSources(selection.sans);
    const family = `Civica Type Lab Sans ${selection.sans} ${selection.sansSize}`;

    if (sources.length === 0) {
      removeBodyOverrides();
      setSansError(true);
      setSansStatus("Current sans source could not be resized");
      return;
    }

    const pending = sources.flatMap((source) => {
      const normal = new FontFace(
        family,
        faceSource(
          source.normal,
          source.local,
          source.raw,
          source.format,
        ),
        sizedFaceDescriptors("normal", source.weight, selection.sansSize),
      );
      const italic = source.italic
        ? new FontFace(
            family,
            faceSource(
              source.italic,
              source.local,
              source.raw,
              source.format,
            ),
            sizedFaceDescriptors("italic", source.weight, selection.sansSize),
          )
        : null;
      return [
        { face: normal, required: source.weight.startsWith("400") },
        ...(italic ? [{ face: italic, required: false }] : []),
      ];
    });

    void Promise.allSettled(pending.map(({ face }) => face.load()))
      .then((results) => {
        if (cancelled) return;

        const faces = results.flatMap((result) =>
          result.status === "fulfilled" ? [result.value] : [],
        );
        const requiredFaceLoaded = results.some(
          (result, index) =>
            pending[index]?.required && result.status === "fulfilled",
        );

        if (!requiredFaceLoaded) {
          throw new Error("The regular face could not be loaded");
        }

        faces.forEach((face) => {
          document.fonts.add(face);
          loadedFaces.push(face);
        });
        const stack = `"${family}", var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        root.style.setProperty("--font-body", stack);
        root.style.setProperty("--font-body-sans", stack);
        root.style.setProperty("--font-sans", "var(--font-body)");
        root.style.setProperty("--font-mono", stack);
        const label = SANS_ITEMS.find(
          (item) => item.value === selection.sans,
        )?.label;
        setSansStatus(
          faces.length === pending.length
            ? `${label} ready`
            : `${label} ready · ${faces.length}/${pending.length} faces`,
        );
      })
      .catch(() => {
        if (cancelled) return;
        removeBodyOverrides();
        setSansError(true);
        setSansStatus(
          selection.sans === "diatype"
            ? "ABC Diatype needs to be installed in Font Book first"
            : selection.sans === "arbeit"
              ? "Arbeit Pro needs to be installed in Font Book first"
              : selection.sans === "centra"
                ? "Centra No2 needs to be installed in Font Book first"
            : selection.sans === "inter"
              ? "Current sans source could not be resized"
              : isOpenSans(selection.sans)
                ? "Free sans file is unavailable in local/type-lab-fonts"
              : "Sans trial file is unavailable in Downloads",
        );
      });

    return () => {
      cancelled = true;
      loadedFaces.forEach((face) => document.fonts.delete(face));
    };
  }, [selection.sans, selection.sansSize]);

  const setMenu = (menu: Exclude<OpenMenu, null>, open: boolean) => {
    setOpenMenu(open ? menu : null);
  };

  const reset = () => {
    setSelection(DEFAULT_SELECTION);
    setOpenMenu(null);
  };

  return (
    <div className={styles.root} ref={rootRef} data-type-lab>
      {expanded ? (
        <aside className={styles.panel} aria-label="Civica typography lab">
          <div className={styles.header}>
            <div>
              <p className={styles.eyebrow}>Private local preview</p>
              <h2 className={styles.title}>Civica type lab</h2>
            </div>
            <Button
              variant="tertiary"
              size="sm"
              className={styles.iconButton}
              aria-label="Close typography lab"
              onClick={() => {
                setExpanded(false);
                setOpenMenu(null);
              }}
            >
              <X aria-hidden="true" focusable="false" />
            </Button>
          </div>

          <div className={styles.controls}>
            <SingleSelectMenu
              label="Pair preset"
              value={activePreset}
              items={presetItems}
              open={openMenu === "preset"}
              onOpenChange={(open) => setMenu("preset", open)}
              onSelect={(value) => {
                if (value !== "custom")
                  setSelection((current) => ({
                    ...current,
                    ...PRESETS[value as Exclude<PresetId, "custom">],
                  }));
              }}
              ariaLabel="Choose a typography pair preset"
            />

            <div className={styles.controlGrid}>
              <SingleSelectMenu
                label="Serif"
                value={selection.serif}
                items={SERIF_ITEMS}
                open={openMenu === "serif"}
                onOpenChange={(open) => setMenu("serif", open)}
                onSelect={(value) =>
                  setSelection((current) => ({
                    ...current,
                    serif: value as SerifId,
                  }))
                }
                ariaLabel="Choose the Civica serif"
              />
              <SingleSelectMenu
                label="Sans"
                value={selection.sans}
                items={SANS_ITEMS}
                open={openMenu === "sans"}
                onOpenChange={(open) => setMenu("sans", open)}
                onSelect={(value) =>
                  setSelection((current) => ({
                    ...current,
                    sans: value as SansId,
                  }))
                }
                ariaLabel="Choose the Civica sans serif"
              />
            </div>

            <div className={styles.sizeGrid}>
              <PercentageControl
                id="type-lab-serif-size"
                label="Serif size"
                value={selection.serifSize}
                min={MIN_FONT_SIZE}
                max={MAX_FONT_SIZE}
                onChange={(serifSize) =>
                  setSelection((current) => ({ ...current, serifSize }))
                }
              />
              <PercentageControl
                id="type-lab-sans-size"
                label="Sans size"
                value={selection.sansSize}
                min={MIN_FONT_SIZE}
                max={MAX_FONT_SIZE}
                onChange={(sansSize) =>
                  setSelection((current) => ({ ...current, sansSize }))
                }
              />
            </div>

            <PercentageControl
              id="type-lab-line-height"
              label="Line height · all text"
              value={selection.lineHeight}
              min={MIN_LINE_HEIGHT}
              max={MAX_LINE_HEIGHT}
              onChange={(lineHeight) =>
                setSelection((current) => ({ ...current, lineHeight }))
              }
            />

            <div>
              <p className={styles.weightLabel}>Serif cut</p>
              <SegmentedControl
                value={selection.cut}
                options={CUT_ITEMS}
                onChange={(cut) =>
                  setSelection((current) => ({ ...current, cut }))
                }
                ariaLabel="Choose the serif cut"
              />
            </div>

            <div className={styles.statusRow} aria-live="polite">
              <p
                className={`${styles.status}${serifError ? ` ${styles.statusError}` : ""}`}
              >
                {serifStatus}
              </p>
              <p
                className={`${styles.status}${sansError ? ` ${styles.statusError}` : ""}`}
              >
                {sansStatus}
              </p>
            </div>
          </div>

          <div className={styles.footer}>
            <p className={styles.note}>
              Free = OFL · Paid = private evaluation only · never production
            </p>
            <Button variant="text" size="sm" onClick={reset}>
              <RotateCcw aria-hidden="true" focusable="false" />
              Reset
            </Button>
          </div>
        </aside>
      ) : null}

      <Button
        variant="secondary"
        size="sm"
        className={styles.trigger}
        aria-label={expanded ? "Hide typography lab" : "Show typography lab"}
        onClick={() => setExpanded((current) => !current)}
      >
        <Type aria-hidden="true" focusable="false" />
        Type lab
      </Button>
    </div>
  );
}
