import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const downloads = (...parts: string[]) =>
  join(homedir(), "Downloads", ...parts);
const openFonts = (...parts: string[]) =>
  join(process.cwd(), "local", "type-lab-fonts", ...parts);

/**
 * Development-only font sources for the private Civica typography lab.
 *
 * Paid trial binaries stay in Downloads. OFL alternatives live in the
 * gitignored local/type-lab-fonts directory. Neither enters the repository or
 * a production bundle. The requested key is resolved through this closed map;
 * user input is never joined into a filesystem path.
 */
const FONT_FILES = {
  "signifier-light": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test Signifier",
    "test-signifier-light.woff2",
  ),
  "signifier-light-italic": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test Signifier",
    "test-signifier-light-italic.woff2",
  ),
  "signifier-regular": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test Signifier",
    "test-signifier-regular.woff2",
  ),
  "signifier-regular-italic": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test Signifier",
    "test-signifier-regular-italic.woff2",
  ),
  "signifier-medium": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test Signifier",
    "test-signifier-medium.woff2",
  ),
  "signifier-medium-italic": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test Signifier",
    "test-signifier-medium-italic.woff2",
  ),
  "tiempos-fine-light": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test Tiempos Collection",
    "Test Tiempos Fine",
    "test-tiempos-fine-light.woff2",
  ),
  "tiempos-fine-light-italic": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test Tiempos Collection",
    "Test Tiempos Fine",
    "test-tiempos-fine-light-italic.woff2",
  ),
  "tiempos-fine-regular": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test Tiempos Collection",
    "Test Tiempos Fine",
    "test-tiempos-fine-regular.woff2",
  ),
  "tiempos-fine-regular-italic": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test Tiempos Collection",
    "Test Tiempos Fine",
    "test-tiempos-fine-regular-italic.woff2",
  ),
  "tiempos-fine-medium": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test Tiempos Collection",
    "Test Tiempos Fine",
    "test-tiempos-fine-medium.woff2",
  ),
  "tiempos-fine-medium-italic": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test Tiempos Collection",
    "Test Tiempos Fine",
    "test-tiempos-fine-medium-italic.woff2",
  ),
  "tiempos-headline-light": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test Tiempos Collection",
    "Test Tiempos Headline",
    "test-tiempos-headline-light.woff2",
  ),
  "tiempos-headline-light-italic": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test Tiempos Collection",
    "Test Tiempos Headline",
    "test-tiempos-headline-light-italic.woff2",
  ),
  "tiempos-headline-regular": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test Tiempos Collection",
    "Test Tiempos Headline",
    "test-tiempos-headline-regular.woff2",
  ),
  "tiempos-headline-regular-italic": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test Tiempos Collection",
    "Test Tiempos Headline",
    "test-tiempos-headline-regular-italic.woff2",
  ),
  "tiempos-headline-medium": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test Tiempos Collection",
    "Test Tiempos Headline",
    "test-tiempos-headline-medium.woff2",
  ),
  "tiempos-headline-medium-italic": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test Tiempos Collection",
    "Test Tiempos Headline",
    "test-tiempos-headline-medium-italic.woff2",
  ),
  "martina-light": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test Martina Plantijn",
    "test-martina-plantijn-light.woff2",
  ),
  "martina-light-italic": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test Martina Plantijn",
    "test-martina-plantijn-light-italic.woff2",
  ),
  "martina-regular": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test Martina Plantijn",
    "test-martina-plantijn-regular.woff2",
  ),
  "martina-medium": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test Martina Plantijn",
    "test-martina-plantijn-medium.woff2",
  ),
  "martina-medium-italic": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test Martina Plantijn",
    "test-martina-plantijn-medium-italic.woff2",
  ),
  "suisse-works-book": downloads(
    "swisstypefaces-free-trial-suisse",
    "extracted",
    "Suisse-FreeTrial-2024",
    "SuisseWorks-FreeTrial",
    "Web",
    "Woff2",
    "SuisseWorks-Book-WebTrial.woff2",
  ),
  "suisse-works-book-italic": downloads(
    "swisstypefaces-free-trial-suisse",
    "extracted",
    "Suisse-FreeTrial-2024",
    "SuisseWorks-FreeTrial",
    "Web",
    "Woff2",
    "SuisseWorks-BookItalic-WebTrial.woff2",
  ),
  "suisse-works-regular": downloads(
    "swisstypefaces-free-trial-suisse",
    "extracted",
    "Suisse-FreeTrial-2024",
    "SuisseWorks-FreeTrial",
    "Web",
    "Woff2",
    "SuisseWorks-Regular-WebTrial.woff2",
  ),
  "suisse-works-regular-italic": downloads(
    "swisstypefaces-free-trial-suisse",
    "extracted",
    "Suisse-FreeTrial-2024",
    "SuisseWorks-FreeTrial",
    "Web",
    "Woff2",
    "SuisseWorks-RegularItalic-WebTrial.woff2",
  ),
  "suisse-works-medium": downloads(
    "swisstypefaces-free-trial-suisse",
    "extracted",
    "Suisse-FreeTrial-2024",
    "SuisseWorks-FreeTrial",
    "Web",
    "Woff2",
    "SuisseWorks-Medium-WebTrial.woff2",
  ),
  "suisse-intl-regular": downloads(
    "swisstypefaces-free-trial-suisse",
    "extracted",
    "Suisse-FreeTrial-2024",
    "SuisseIntl-FreeTrial",
    "Web",
    "WOFF2",
    "SuisseIntlTrial-Regular.woff2",
  ),
  "suisse-intl-regular-italic": downloads(
    "swisstypefaces-free-trial-suisse",
    "extracted",
    "Suisse-FreeTrial-2024",
    "SuisseIntl-FreeTrial",
    "Web",
    "WOFF2",
    "SuisseIntlTrial-RegularIt.woff2",
  ),
  "suisse-intl-medium": downloads(
    "swisstypefaces-free-trial-suisse",
    "extracted",
    "Suisse-FreeTrial-2024",
    "SuisseIntl-FreeTrial",
    "Web",
    "WOFF2",
    "SuisseIntlTrial-Medium.woff2",
  ),
  "suisse-intl-medium-italic": downloads(
    "swisstypefaces-free-trial-suisse",
    "extracted",
    "Suisse-FreeTrial-2024",
    "SuisseIntl-FreeTrial",
    "Web",
    "WOFF2",
    "SuisseIntlTrial-MediumIt.woff2",
  ),
  "suisse-intl-semibold": downloads(
    "swisstypefaces-free-trial-suisse",
    "extracted",
    "Suisse-FreeTrial-2024",
    "SuisseIntl-FreeTrial",
    "Web",
    "WOFF2",
    "SuisseIntlTrial-Semibold.woff2",
  ),
  "suisse-intl-semibold-italic": downloads(
    "swisstypefaces-free-trial-suisse",
    "extracted",
    "Suisse-FreeTrial-2024",
    "SuisseIntl-FreeTrial",
    "Web",
    "WOFF2",
    "SuisseIntlTrial-SemiboldIt.woff2",
  ),
  "national-regular": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test National",
    "test-national-regular.woff2",
  ),
  "national-regular-italic": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test National",
    "test-national-regular-italic.woff2",
  ),
  "national-medium": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test National",
    "test-national-medium.woff2",
  ),
  "national-medium-italic": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test National",
    "test-national-medium-italic.woff2",
  ),
  "national-semibold": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test National",
    "test-national-semibold.woff2",
  ),
  "national-semibold-italic": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test National",
    "test-national-semibold-italic.woff2",
  ),
  "metric-regular": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test Metric",
    "test-metric-regular.woff2",
  ),
  "metric-regular-italic": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test Metric",
    "test-metric-regular-italic.woff2",
  ),
  "metric-medium": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test Metric",
    "test-metric-medium.woff2",
  ),
  "metric-medium-italic": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test Metric",
    "test-metric-medium-italic.woff2",
  ),
  "metric-semibold": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test Metric",
    "test-metric-semibold.woff2",
  ),
  "metric-semibold-italic": downloads(
    "KlimTestFonts",
    "Test web fonts (Static, WOFF2)",
    "Test Metric",
    "test-metric-semibold-italic.woff2",
  ),
  "arbeit-regular": downloads(
    "ArbeitPro_FullFamily",
    "WOFF",
    "ArbeitPro-Regular.woff2",
  ),
  "arbeit-regular-italic": downloads(
    "ArbeitPro_FullFamily",
    "WOFF",
    "ArbeitPro-RegularItalic.woff2",
  ),
  "arbeit-medium": downloads(
    "ArbeitPro_FullFamily",
    "WOFF",
    "ArbeitPro-Medium.woff2",
  ),
  "arbeit-medium-italic": downloads(
    "ArbeitPro_FullFamily",
    "WOFF",
    "ArbeitPro-MediumItalic.woff2",
  ),
  "arbeit-semibold": downloads(
    "ArbeitPro_FullFamily",
    "WOFF",
    "ArbeitPro-Semi-Bold.woff2",
  ),
  "arbeit-semibold-italic": downloads(
    "ArbeitPro_FullFamily",
    "WOFF",
    "ArbeitPro-Semi-BoldItalic.woff2",
  ),
  "centra-book": downloads("Centra No2", "CentraNo2-Book.woff2"),
  "centra-book-italic": downloads("Centra No2", "CentraNo2-BookItalic.woff2"),
  "centra-medium": downloads("Centra No2", "CentraNo2-Medium.woff2"),
  "centra-medium-italic": downloads(
    "Centra No2",
    "CentraNo2-MediumItalic.woff2",
  ),
  "centra-bold": downloads("Centra No2", "CentraNo2-Bold.woff2"),
  "centra-bold-italic": downloads("Centra No2", "CentraNo2-BoldItalic.woff2"),
  "open-instrument-serif-regular": openFonts("InstrumentSerif-Regular.ttf"),
  "open-instrument-serif-italic": openFonts("InstrumentSerif-Italic.ttf"),
  "open-newsreader-variable": openFonts("Newsreader-Variable.ttf"),
  "open-newsreader-italic-variable": openFonts(
    "Newsreader-Italic-Variable.ttf",
  ),
  "open-eb-garamond-variable": openFonts("EBGaramond-Variable.ttf"),
  "open-eb-garamond-italic-variable": openFonts(
    "EBGaramond-Italic-Variable.ttf",
  ),
  "open-cormorant-garamond-variable": openFonts(
    "CormorantGaramond-Variable.ttf",
  ),
  "open-cormorant-garamond-italic-variable": openFonts(
    "CormorantGaramond-Italic-Variable.ttf",
  ),
  "open-instrument-sans-variable": openFonts("InstrumentSans-Variable.ttf"),
  "open-instrument-sans-italic-variable": openFonts(
    "InstrumentSans-Italic-Variable.ttf",
  ),
  "open-work-sans-variable": openFonts("WorkSans-Variable.ttf"),
  "open-work-sans-italic-variable": openFonts(
    "WorkSans-Italic-Variable.ttf",
  ),
  "open-public-sans-variable": openFonts("PublicSans-Variable.ttf"),
  "open-public-sans-italic-variable": openFonts(
    "PublicSans-Italic-Variable.ttf",
  ),
  "open-source-sans-3-variable": openFonts("SourceSans3-Variable.ttf"),
  "open-source-sans-3-italic-variable": openFonts(
    "SourceSans3-Italic-Variable.ttf",
  ),
  "open-archivo-variable": openFonts("Archivo-Variable.ttf"),
  "open-archivo-italic-variable": openFonts("Archivo-Italic-Variable.ttf"),
  "open-manrope-variable": openFonts("Manrope-Variable.ttf"),
} as const;

export async function GET(
  _request: Request,
  context: { params: Promise<{ font: string }> },
) {
  if (process.env.NODE_ENV !== "development") {
    return new Response(null, { status: 404 });
  }

  const { font } = await context.params;
  const path = FONT_FILES[font as keyof typeof FONT_FILES];

  if (!path) {
    return new Response(null, { status: 404 });
  }

  try {
    const data = await readFile(path);

    return new Response(data, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": path.endsWith(".ttf") ? "font/ttf" : "font/woff2",
      },
    });
  } catch {
    return Response.json(
      { error: "The local Type Lab font could not be read." },
      { status: 404 },
    );
  }
}
