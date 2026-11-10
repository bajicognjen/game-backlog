/** The proxy against a stubbed upstream `fetch`: who it serves, where it goes, what it passes on. */
import { describe, expect, it, vi } from "vitest";
import { PROXY_PATH, PROXY_URL_HEADER } from "../src/platform/proxy";
import { handleProxy } from "./proxy";

const ORIGIN = "https://game-backlog.example.workers.dev";
const IGDB = "https://api.igdb.com/v4/games";
const SAME_ORIGIN = { "Sec-Fetch-Site": "same-origin" };

const request = (headers: Record<string, string>, init: RequestInit = {}) => new Request(`${ORIGIN}${PROXY_PATH}`, { ...init, headers });

const upstream = (body = "{}", status = 200, headers: Record<string, string> = { "Content-Type": "application/json", "Set-Cookie": "a=b" }) =>
  vi.fn(async (_url: string, _init: RequestInit) => new Response(body, { status, headers }));

describe("handleProxy", () => {
  it("serves only pages of its own origin", async () => {
    const fetch = upstream();
    expect((await handleProxy(request({ [PROXY_URL_HEADER]: IGDB }), fetch)).status).toBe(403);
    expect((await handleProxy(request({ "Sec-Fetch-Site": "cross-site", [PROXY_URL_HEADER]: IGDB }), fetch)).status).toBe(403);
    expect((await handleProxy(request({ Origin: "https://evil.example", [PROXY_URL_HEADER]: IGDB }), fetch)).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();

    // A browser without Sec-Fetch-Site still names its origin on a POST.
    expect((await handleProxy(request({ Origin: ORIGIN, [PROXY_URL_HEADER]: IGDB }, { method: "POST", body: "x" }), fetch)).status).toBe(200);
  });

  it("reaches only the listed hosts, over https", async () => {
    const fetch = upstream();
    for (const url of ["https://example.com/", "http://api.igdb.com/v4/games", "https://api.igdb.com.evil.example/", "not a url", ""]) {
      const response = await handleProxy(request({ ...SAME_ORIGIN, [PROXY_URL_HEADER]: url }), fetch);
      expect(response.status, url).toBe(403);
    }
    expect((await handleProxy(request(SAME_ORIGIN), fetch)).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("passes only GET and POST", async () => {
    const fetch = upstream();
    expect((await handleProxy(request({ ...SAME_ORIGIN, [PROXY_URL_HEADER]: IGDB }, { method: "DELETE" }), fetch)).status).toBe(405);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards the method, body and API headers, but not the browser's or Cloudflare's", async () => {
    const fetch = upstream('[{"id":1}]');
    const response = await handleProxy(
      request(
        {
          ...SAME_ORIGIN,
          [PROXY_URL_HEADER]: IGDB,
          "Client-ID": "abc",
          Authorization: "Bearer t",
          "Content-Type": "text/plain",
          Accept: "application/json",
          Cookie: "session=1",
          Referer: `${ORIGIN}/`,
          "CF-Connecting-IP": "1.2.3.4",
          "X-Forwarded-For": "1.2.3.4",
        },
        { method: "POST", body: 'fields name; search "hades";' },
      ),
      fetch,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('[{"id":1}]');
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(IGDB);
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("manual");
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe('fields name; search "hades";');
    const sent = init.headers as Headers;
    expect(sent.get("client-id")).toBe("abc");
    expect(sent.get("authorization")).toBe("Bearer t");
    expect(sent.get("content-type")).toBe("text/plain");
    expect(sent.get("accept")).toBe("application/json");
    for (const dropped of ["cookie", "referer", "sec-fetch-site", "cf-connecting-ip", "x-forwarded-for", PROXY_URL_HEADER]) {
      expect(sent.get(dropped), dropped).toBeNull();
    }
  });

  it("keeps a Steam key in the forwarded URL and out of its own", async () => {
    const steam = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=SECRET&steamid=1&format=json";
    const fetch = upstream();
    const incoming = request({ ...SAME_ORIGIN, [PROXY_URL_HEADER]: steam });
    expect(incoming.url).not.toContain("SECRET");
    await handleProxy(incoming, fetch);
    expect(fetch.mock.calls[0][0]).toBe(steam);
    expect(fetch.mock.calls[0][1].body).toBeUndefined();
  });

  it("passes an upstream error status through, so the app can tell a rejected key", async () => {
    const response = await handleProxy(request({ ...SAME_ORIGIN, [PROXY_URL_HEADER]: IGDB }), upstream("Unauthorized", 401, { "Content-Type": "text/plain" }));
    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized");
  });

  it("answers 502 when the upstream cannot be reached", async () => {
    const fetch = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED");
    });
    const response = await handleProxy(request({ ...SAME_ORIGIN, [PROXY_URL_HEADER]: IGDB }), fetch);
    expect(response.status).toBe(502);
    expect(await response.text()).toContain("api.igdb.com");
  });
});
