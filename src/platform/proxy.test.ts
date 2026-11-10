import { describe, expect, it } from "vitest";
import { PROXY_PATH, PROXY_URL_HEADER, isProxiedUrl, viaProxy } from "./proxy";

describe("viaProxy", () => {
  it("sends the APIs without CORS headers to the Worker, with the real URL in a header", () => {
    const steam = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=SECRET&steamid=1";
    const { url, init } = viaProxy(steam, { method: "GET", headers: { Accept: "application/json" } });
    expect(url).toBe(PROXY_PATH);
    expect(init?.method).toBe("GET");
    const headers = new Headers(init?.headers);
    expect(headers.get(PROXY_URL_HEADER)).toBe(steam);
    expect(headers.get("Accept")).toBe("application/json");
  });

  it("leaves other hosts alone", () => {
    const init = { method: "GET" };
    const result = viaProxy("https://api.github.com/repos/x/y/releases/latest", init);
    expect(result.url).toBe("https://api.github.com/repos/x/y/releases/latest");
    expect(result.init).toBe(init);
  });

  it("covers Twitch, IGDB and Steam over https only", () => {
    expect(isProxiedUrl("https://id.twitch.tv/oauth2/token")).toBe(true);
    expect(isProxiedUrl("https://api.igdb.com/v4/games")).toBe(true);
    expect(isProxiedUrl("https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=k")).toBe(true);
    expect(isProxiedUrl("http://api.igdb.com/v4/games")).toBe(false);
    expect(isProxiedUrl("https://api.igdb.com.evil.example/v4/games")).toBe(false);
    expect(isProxiedUrl("not a url")).toBe(false);
  });
});
