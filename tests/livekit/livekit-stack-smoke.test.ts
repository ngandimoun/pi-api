import { describe, expect, it } from "vitest";

import { createDefaultRoomName, createLiveKitUserToken } from "@/lib/livekit/tokens";
import { verifyAndParseLiveKitWebhook } from "@/lib/livekit/webhooks";

describe("livekit stack (smoke)", () => {
  it("mints a participant token (no network)", async () => {
    process.env.LIVEKIT_API_KEY = "test_key";
    process.env.LIVEKIT_API_SECRET = "test_secret";

    const token = await createLiveKitUserToken({
      room: createDefaultRoomName("test_room"),
      identity: "user_123",
      ttlSeconds: 60,
    });

    expect(token).toMatch(/^eyJ/);
    expect(token.split(".")).toHaveLength(3);
  });

  it("verifies and parses a webhook event when signed (no network)", async () => {
    process.env.LIVEKIT_WEBHOOK_API_KEY = "abcdefg";
    process.env.LIVEKIT_WEBHOOK_API_SECRET = "abababa";

    const body =
      '{"event":"room_started", "room":{"sid":"RM_TkVjUvAqgzKz", "name":"mytestroom", "emptyTimeout":300, "creationTime":"1628545903", "turnPassword":"ICkSr2rEeslkN6e9bXL4Ji5zzMD5Z7zzr6ulOaxMj6N", "enabledCodecs":[{"mime":"audio/opus"}, {"mime":"video/VP8"}]}}';

    // This mirrors how livekit-server-sdk tests WebhookReceiver:
    // - sign a JWT with `sha256` claim matching the body
    // - use that JWT as the `Authorization` header value
    const { AccessToken } = await import("livekit-server-sdk");
    const sha = "CoEQz1chqJ9bnZRcORddjplkvpjmPujmLTR42DbefYI=";
    const t = new AccessToken("abcdefg", "abababa");
    (t as unknown as { sha256: string }).sha256 = sha;
    const authHeader = await t.toJwt();

    const evt = (await verifyAndParseLiveKitWebhook({
      rawBody: body,
      authorizationHeader: authHeader,
    })) as { event?: string; room?: { name?: string } };

    expect(evt.event).toBe("room_started");
    expect(evt.room?.name).toBe("mytestroom");
  });

  it("fails fast when webhook Authorization is missing", async () => {
    await expect(
      verifyAndParseLiveKitWebhook({
        rawBody: "{}",
        authorizationHeader: null,
      })
    ).rejects.toThrow(/Authorization/i);
  });
});

