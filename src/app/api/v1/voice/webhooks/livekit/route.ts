import { NextRequest, NextResponse } from "next/server";

import { verifyAndParseLiveKitWebhook } from "@/lib/livekit/webhooks";
import { handleLiveKitVoiceWebhookEvent } from "@/lib/voice/handle-livekit-webhook";

/**
 * LiveKit webhook receiver (raw body + signed Authorization). Not authenticated with Pi API keys.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const authorizationHeader = request.headers.get("authorization");

  try {
    const event = await verifyAndParseLiveKitWebhook({
      rawBody,
      authorizationHeader,
    });
    const result = await handleLiveKitVoiceWebhookEvent(event);
    if (!result.ok) {
      return NextResponse.json(
        {
          error: {
            code: "webhook_processing_failed",
            message: result.error,
          },
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ received: true, handled: result.handled });
  } catch {
    return NextResponse.json(
      { error: { code: "webhook_verification_failed", message: "Invalid webhook." } },
      { status: 400 }
    );
  }
}
