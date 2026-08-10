export type CountryHeroPhoto = {
  lightSrc: string;
  darkSrc: string;
  lightCaption: string;
  darkCaption: string;
};

const COUNTRY_HERO_PHOTOS: Record<string, CountryHeroPhoto> = {
  gha: {
    lightSrc: "/image-trials/country-heroes/gha-photographic-v1.webp",
    darkSrc: "/image-trials/country-heroes/gha-photographic-v1-dark.webp",
    lightCaption:
      "Elmina Castle and the fishing harbor on Ghana's Atlantic coast",
    darkCaption: "Elmina Castle and the fishing harbor after nightfall",
  },
  jpn: {
    lightSrc: "/image-trials/country-heroes/jpn-photographic-v1.webp",
    darkSrc: "/image-trials/country-heroes/jpn-photographic-v1-dark.webp",
    lightCaption: "Mount Fuji with a five-storied pagoda and cherry blossom",
    darkCaption: "Mount Fuji and a lantern-lit pagoda at night",
  },
  ury: {
    lightSrc: "/image-trials/country-heroes/ury-photographic-v1.webp",
    darkSrc: "/image-trials/country-heroes/ury-photographic-v1-dark.webp",
    lightCaption: "Montevideo's Rambla and waterfront skyline",
    darkCaption: "Montevideo's waterfront illuminated at night",
  },
};

export function countryHeroPhoto(
  iso3: string | null | undefined,
): CountryHeroPhoto | null {
  if (!iso3) return null;
  return COUNTRY_HERO_PHOTOS[iso3.toLowerCase()] ?? null;
}
