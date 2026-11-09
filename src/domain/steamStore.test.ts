/**
 * Fixtures follow real `IStoreBrowseService/GetItems` rows (Hades, GTA V
 * Enhanced) as Steam returned them, trimmed to the fields the app reads.
 */
import { describe, expect, it } from "vitest";
import { mapStoreItem, storeItemsInput } from "./steamStore";

const hades = {
  item_type: 0,
  id: 1145360,
  success: 1,
  visible: true,
  name: "Hades",
  store_url_path: "app/1145360/Hades/",
  appid: 1145360,
  type: 0,
  reviews: { summary_filtered: { review_count: 287782, percent_positive: 97, review_score: 9, review_score_label: "Overwhelmingly Positive" } },
  assets: { asset_url_format: "steam/apps/1145360/${FILENAME}?t=1758127023", library_capsule: "library_600x900.jpg", header: "header.jpg" },
  release: { steam_release_date: 1600353507, original_steam_release_date: 1575997560 },
  platforms: { windows: true, mac: true, steam_deck_compat_category: 3 },
};

describe("mapStoreItem", () => {
  it("reads name, store page, release day, Steam Deck rating, reviews and the portrait cover", () => {
    expect(mapStoreItem(hades)).toEqual({
      appid: 1145360,
      name: "Hades",
      storeUrl: "https://store.steampowered.com/app/1145360/Hades/",
      releaseDate: "2020-09-17",
      comingSoon: false,
      deck: "verified",
      reviewLabel: "Overwhelmingly Positive",
      reviewPercent: 97,
      reviewCount: 287782,
      coverUrl: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1145360/library_600x900.jpg?t=1758127023",
    });
  });

  it("maps every Steam Deck category and tolerates missing parts", () => {
    const deck = (category: number | undefined) => mapStoreItem({ appid: 1, name: "X", platforms: { steam_deck_compat_category: category } })?.deck;
    expect([deck(3), deck(2), deck(1), deck(0), deck(undefined)]).toEqual(["verified", "playable", "unsupported", "unknown", "unknown"]);
    expect(mapStoreItem({ appid: 3240220, name: "Grand Theft Auto V Enhanced" })).toMatchObject({
      storeUrl: "https://store.steampowered.com/app/3240220/",
      releaseDate: null,
      reviewLabel: null,
      coverUrl: null,
    });
  });

  it("gives no release day for a game still to come", () => {
    expect(mapStoreItem({ appid: 2, name: "Soon", release: { steam_release_date: 1900000000, is_coming_soon: true } })).toMatchObject({
      releaseDate: null,
      comingSoon: true,
    });
  });

  it("drops rows Steam could not answer", () => {
    expect(mapStoreItem({ appid: 5, success: 2 })).toBeNull();
    expect(mapStoreItem({ appid: 5, name: "  ", success: 1 })).toBeNull();
    expect(mapStoreItem(null)).toBeNull();
  });
});

describe("storeItemsInput", () => {
  it("asks for the parts the app reads, in English", () => {
    expect(JSON.parse(storeItemsInput([1145360, 105600.5]))).toEqual({
      ids: [{ appid: 1145360 }, { appid: 105600 }],
      context: { language: "english", country_code: "US" },
      data_request: { include_assets: true, include_release: true, include_platforms: true, include_reviews: true },
    });
  });
});
