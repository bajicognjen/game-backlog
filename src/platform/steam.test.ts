/**
 * The Steam client against a stubbed `fetch` (outside Tauri the client uses
 * the global one): what it asks for, and which failure each answer becomes,
 * since the import dialog picks its message from that.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { SteamError, fetchOwnedGames, resolveSteamId, steamFailureOf, type SteamFailure } from "./steam";

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
