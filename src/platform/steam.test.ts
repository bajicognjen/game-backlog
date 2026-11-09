/**
 * The Steam client against a stubbed `fetch` (outside Tauri the client uses
 * the global one): what it asks for, and which failure each answer becomes,
 * since the import dialog picks its message from that.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { SteamError, fetchOwnedGames, fetchPlayerAchievements, fetchPlayerSummary, fetchStoreItems, fetchWishlist, resolveSteamId, steamFailureOf, type SteamFailure } from "./steam";

const KEY = "TESTKEY";
const STEAM_ID = "76561197960287930";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Answer each request with the next response, or throw the next error. */
function stubFetch(...answers: (Response | Error)[]) {
  const fetch = vi.fn(async (_input: string, _init?: RequestInit) => {
    const next = answers.shift();
    if (!next) throw new Error("unexpected request");
    if (next instanceof Error) throw next;
    return next;
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const requestedUrl = (fetch: ReturnType<typeof stubFetch>, call = 0) => new URL(fetch.mock.calls[call][0]);

async function failureOf(promise: Promise<unknown>): Promise<SteamFailure> {
  try {
    await promise;
  } catch (error) {
    return steamFailureOf(error);
  }
  throw new Error("expected the request to fail");
}

afterEach(() => vi.unstubAllGlobals());

describe("resolveSteamId", () => {
  it("takes a SteamID64 or a profile link as it is, without asking Steam", async () => {
    const fetch = stubFetch();
    expect(await resolveSteamId(KEY, STEAM_ID)).toBe(STEAM_ID);
    expect(await resolveSteamId(KEY, `https://steamcommunity.com/profiles/${STEAM_ID}/`)).toBe(STEAM_ID);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("resolves a custom URL name through ResolveVanityURL", async () => {
    const fetch = stubFetch(json({ response: { success: 1, steamid: STEAM_ID } }));
    expect(await resolveSteamId(KEY, "https://steamcommunity.com/id/gabelogannewell/")).toBe(STEAM_ID);
    const url = requestedUrl(fetch);
    expect(url.origin + url.pathname).toBe("https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/");
    expect(url.searchParams.get("vanityurl")).toBe("gabelogannewell");
    expect(url.searchParams.get("key")).toBe(KEY);
  });

  it("reports a custom name Steam does not know", async () => {
    stubFetch(json({ response: { success: 42, message: "No match" } }));
    expect(await failureOf(resolveSteamId(KEY, "nobody-by-that-name"))).toBe("unknown-account");
  });

  it("reports an account it cannot read without asking Steam", async () => {
    const fetch = stubFetch();
    expect(await failureOf(resolveSteamId(KEY, ""))).toBe("no-credentials");
    expect(await failureOf(resolveSteamId(KEY, "12345"))).toBe("no-credentials");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("fetchOwnedGames", () => {
  const credentials = { apiKey: KEY, steamId: STEAM_ID };

  it("asks for names and played free games, and keeps only well-formed rows", async () => {
    const fetch = stubFetch(
      json({
        response: {
          game_count: 3,
          games: [
            { appid: 292030, name: "The Witcher 3: Wild Hunt", playtime_forever: 1230, rtime_last_played: 1_793_534_400 },
            { appid: 1, playtime_forever: 5 },
            { appid: 1091500, name: "Cyberpunk 2077", playtime_forever: 0 },
          ],
        },
      }),
    );
    const games = await fetchOwnedGames(credentials);
    expect(games.map((g) => g.appid)).toEqual([292030, 1091500]);
    const url = requestedUrl(fetch);
    expect(url.origin + url.pathname).toBe("https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      key: KEY,
      steamid: STEAM_ID,
      include_appinfo: "1",
      include_played_free_games: "1",
      format: "json",
    });
  });

  it("reads an answer without a game list as a private profile", async () => {
    stubFetch(json({ response: {} }));
    expect(await failureOf(fetchOwnedGames(credentials))).toBe("private");
  });

  it("tells a rejected key from other HTTP errors", async () => {
    stubFetch(json({}, 401), json({}, 403), json({}, 429), json({}, 500));
    expect(await failureOf(fetchOwnedGames(credentials))).toBe("unauthorized");
    expect(await failureOf(fetchOwnedGames(credentials))).toBe("unauthorized");
    expect(await failureOf(fetchOwnedGames(credentials))).toBe("other");
    expect(await failureOf(fetchOwnedGames(credentials))).toBe("other");
  });

  it("reports a body that is not JSON", async () => {
    stubFetch(new Response("<html>Service Unavailable</html>", { status: 200 }));
    expect(await failureOf(fetchOwnedGames(credentials))).toBe("other");
  });

  it("reports an unreachable Steam as a network failure", async () => {
    stubFetch(new TypeError("fetch failed"));
    expect(await failureOf(fetchOwnedGames(credentials))).toBe("network");
  });
});

describe("steamFailureOf", () => {
  it("keeps a Steam failure and calls anything unexpected other", () => {
    expect(steamFailureOf(new SteamError("private"))).toBe("private");
    expect(steamFailureOf(new Error("boom"))).toBe("other");
    expect(steamFailureOf("not an error")).toBe("other");
  });
});

describe("fetchPlayerAchievements", () => {
  const credentials = { apiKey: KEY, steamId: STEAM_ID };

  it("asks for one game's achievements in English and keeps well-formed rows", async () => {
    const fetch = stubFetch(
      json({
        playerstats: {
          steamID: STEAM_ID,
          gameName: "Marvel's Spider-Man 2",
          success: true,
          achievements: [
            { apiname: "HEAL", achieved: 1, unlocktime: 1_788_177_600, name: "Heal the World", description: "Finish the main story" },
            { apiname: "BROKEN", achieved: 1 },
          ],
        },
      }),
    );
    const list = await fetchPlayerAchievements(credentials, 2651280);
    expect(list?.map((a) => a.apiname)).toEqual(["HEAL"]);
    const url = requestedUrl(fetch);
    expect(url.origin + url.pathname).toBe("https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/");
    expect(Object.fromEntries(url.searchParams)).toEqual({ key: KEY, steamid: STEAM_ID, appid: "2651280", l: "english", format: "json" });
  });

  it("has nothing to show for a game without achievements, or one not owned", async () => {
    stubFetch(
      json({ playerstats: { error: "Requested app has no stats", success: false } }, 400),
      json({ playerstats: { error: "Profile is not public", success: false } }, 403),
      json({ playerstats: { steamID: STEAM_ID, gameName: "No Stats", success: true } }),
    );
    expect(await fetchPlayerAchievements(credentials, 228980)).toBeNull();
    expect(await fetchPlayerAchievements(credentials, 220)).toBeNull();
    expect(await fetchPlayerAchievements(credentials, 1)).toBeNull();
  });

  it("reports a rejected key and an unreachable Steam", async () => {
    stubFetch(new Response("<html><body>Forbidden</body></html>", { status: 403 }), new TypeError("fetch failed"));
    expect(await failureOf(fetchPlayerAchievements(credentials, 1))).toBe("unauthorized");
    expect(await failureOf(fetchPlayerAchievements(credentials, 1))).toBe("network");
  });
});

describe("fetchPlayerSummary", () => {
  const credentials = { apiKey: KEY, steamId: STEAM_ID };
  const player = (extra: Record<string, unknown>) =>
    json({
      response: {
        players: [
          {
            steamid: STEAM_ID,
            personaname: "Ognjen",
            profileurl: `https://steamcommunity.com/profiles/${STEAM_ID}/`,
            avatarmedium: "https://avatars.steamstatic.com/abc_medium.jpg",
            communityvisibilitystate: 3,
            ...extra,
          },
        ],
      },
    });

  it("asks for the account's summary and reads name, avatar, visibility and the game being played", async () => {
    const fetch = stubFetch(player({ gameextrainfo: "Hades" }));
    expect(await fetchPlayerSummary(credentials)).toEqual({
      steamid: STEAM_ID,
      personaname: "Ognjen",
      profileurl: `https://steamcommunity.com/profiles/${STEAM_ID}/`,
      avatarmedium: "https://avatars.steamstatic.com/abc_medium.jpg",
      isPublic: true,
      playing: "Hades",
    });
    const url = requestedUrl(fetch);
    expect(url.origin + url.pathname).toBe("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/");
    expect(url.searchParams.get("steamids")).toBe(STEAM_ID);
  });

  it("marks private and friends-only profiles as not public, and drops a non-https avatar", async () => {
    stubFetch(player({ communityvisibilitystate: 1, avatarmedium: "http://insecure/a.jpg" }), player({ communityvisibilitystate: 2 }));
    expect(await fetchPlayerSummary(credentials)).toMatchObject({ isPublic: false, avatarmedium: null, playing: null });
    expect(await fetchPlayerSummary(credentials)).toMatchObject({ isPublic: false });
  });

  it("returns null for an account Steam does not know, and reports a rejected key", async () => {
    stubFetch(json({ response: { players: [] } }), json({}, 403));
    expect(await fetchPlayerSummary(credentials)).toBeNull();
    expect(await failureOf(fetchPlayerSummary(credentials))).toBe("unauthorized");
  });
});

describe("fetchWishlist", () => {
  it("asks for the account's wishlist without a key and reads ids, ranks and dates", async () => {
    const fetch = stubFetch(
      json({ response: { items: [{ appid: 620, priority: 0, date_added: 1700000000 }, { appid: 413150, priority: 1, date_added: 1600000000 }, { priority: 2 }] } }),
    );
    expect(await fetchWishlist(STEAM_ID)).toEqual([
      { appid: 620, priority: 0, dateAdded: 1700000000 },
      { appid: 413150, priority: 1, dateAdded: 1600000000 },
    ]);
    const url = requestedUrl(fetch);
    expect(url.origin + url.pathname).toBe("https://api.steampowered.com/IWishlistService/GetWishlist/v1/");
    expect(url.searchParams.get("steamid")).toBe(STEAM_ID);
    expect(url.searchParams.has("key")).toBe(false);
  });

  it("reads a private or empty wishlist as empty", async () => {
    stubFetch(json({ response: {} }));
    expect(await fetchWishlist(STEAM_ID)).toEqual([]);
  });
});

describe("fetchStoreItems", () => {
  it("asks the store in batches of 50 and keys the answers by app id", async () => {
    const ids = Array.from({ length: 60 }, (_, i) => i + 1);
    const page = (from: number, to: number) => json({ response: { store_items: ids.slice(from, to).map((appid) => ({ appid, name: `Game ${appid}`, success: 1 })) } });
    const fetch = stubFetch(page(0, 50), page(50, 60));
    const items = await fetchStoreItems(ids);
    expect(items.size).toBe(60);
    expect(items.get(55)?.name).toBe("Game 55");
    expect(fetch).toHaveBeenCalledTimes(2);
    const input = JSON.parse(requestedUrl(fetch, 1).searchParams.get("input_json") ?? "{}") as { ids: { appid: number }[] };
    expect(input.ids.map((i) => i.appid)).toEqual(ids.slice(50));
    expect(requestedUrl(fetch).pathname).toBe("/IStoreBrowseService/GetItems/v1/");
  });
});
