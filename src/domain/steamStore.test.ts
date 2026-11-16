/**
 * Fixtures follow real `IStoreBrowseService/GetItems` rows (Hades, GTA V
 * Enhanced, Bodycam on sale, Cyberpunk 2077 at full price, Dota 2 for free)
 * as Steam returned them, trimmed to the fields the app reads.
 */
import { describe, expect, it } from "vitest";
import { mapStoreItem, parseSteamCountry, storeItemsInput } from "./steamStore";

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

/** Priced for Serbia (euros) on 2026-11-16, 20% off until 2026-11-19. */
const bodycam = {
  id: 2406770,
  success: 1,
  name: "Bodycam",
  store_url_path: "app/2406770/Bodycam",
  appid: 2406770,
  best_purchase_option: {
    packageid: 866042,
    purchase_option_name: "Bodycam",
    final_price_in_cents: "2665",
    original_price_in_cents: "3332",
    formatted_final_price: "26,65€",
    formatted_original_price: "33,32€",
    discount_pct: 20,
    active_discounts: [{ discount_amount: "667", discount_description: "#discount_desc_preset_special", discount_end_date: 1795208400 }],
    user_can_purchase_as_gift: true,
    hide_discount_pct_for_compliance: false,
    included_game_count: 1,
    must_purchase_as_set: false,
    package_group: "default",
    price_cannot_be_displayed_as_discount: false,
  },
};

const cyberpunk = {
  id: 1091500,
  success: 1,
  name: "Cyberpunk 2077",
  appid: 1091500,
  best_purchase_option: {
    packageid: 367653,
    purchase_option_name: "Cyberpunk 2077",
    final_price_in_cents: "5999",
    formatted_final_price: "59,99€",
    user_can_purchase_as_gift: true,
    hide_discount_pct_for_compliance: false,
    included_game_count: 1,
    must_purchase_as_set: false,
    package_group: "default",
    price_cannot_be_displayed_as_discount: false,
  },
};

const dota = { id: 570, success: 1, name: "Dota 2", appid: 570, is_free: true };

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
      free: false,
      price: null,
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

  it("reads a discounted price with both amounts, the percent off and when the sale ends", () => {
    expect(mapStoreItem(bodycam)).toMatchObject({
      free: false,
      price: {
        finalCents: 2665,
        originalCents: 3332,
        finalText: "26,65€",
        originalText: "33,32€",
        discountPct: 20,
        discountEndsAt: 1795208400000,
      },
    });
  });

  it("reads a full price as its own original, with no discount and no end", () => {
    expect(mapStoreItem(cyberpunk)?.price).toEqual({
      finalCents: 5999,
      originalCents: 5999,
      finalText: "59,99€",
      originalText: "59,99€",
      discountPct: 0,
      discountEndsAt: null,
    });
  });

  it("marks a free game and gives it no price", () => {
    expect(mapStoreItem(dota)).toMatchObject({ free: true, price: null });
  });

  it("gives no price for a game the store does not sell on its own, or with an amount that does not parse", () => {
    expect(mapStoreItem({ appid: 7, name: "Unreleased" })?.price).toBeNull();
    expect(mapStoreItem({ appid: 8, name: "Odd", best_purchase_option: { final_price_in_cents: "soon" } })?.price).toBeNull();
    expect(mapStoreItem({ appid: 9, name: "Odd", best_purchase_option: { final_price_in_cents: "-5" } })?.price).toBeNull();
  });

  it("takes the earliest end when discounts stack, and none without a discount", () => {
    const priced = (option: Record<string, unknown>) => mapStoreItem({ appid: 10, name: "X", best_purchase_option: { final_price_in_cents: "1000", ...option } })?.price;
    expect(priced({ discount_pct: 50, active_discounts: [{ discount_end_date: 1800000000 }, { discount_end_date: 1790000000 }] })?.discountEndsAt).toBe(1790000000000);
    expect(priced({ discount_pct: 50, active_discounts: [] })?.discountEndsAt).toBeNull();
    expect(priced({ active_discounts: [{ discount_end_date: 1800000000 }] })).toMatchObject({ discountPct: 0, discountEndsAt: null });
  });
});

describe("storeItemsInput", () => {
  it("asks for the parts the app reads, in English, priced for the country", () => {
    expect(JSON.parse(storeItemsInput([1145360, 105600.5], "de"))).toEqual({
      ids: [{ appid: 1145360 }, { appid: 105600 }],
      context: { language: "english", country_code: "DE" },
      data_request: { include_assets: true, include_release: true, include_platforms: true, include_reviews: true },
    });
  });
});

describe("parseSteamCountry", () => {
  it("keeps a two-letter code in upper case and falls back to Serbia for anything else", () => {
    expect(parseSteamCountry("de")).toBe("DE");
    expect(parseSteamCountry(" rs ")).toBe("RS");
    expect(parseSteamCountry("US")).toBe("US");
    expect([parseSteamCountry(undefined), parseSteamCountry(""), parseSteamCountry("xyz"), parseSteamCountry("R1"), parseSteamCountry(5)]).toEqual(["RS", "RS", "RS", "RS", "RS"]);
  });
});
