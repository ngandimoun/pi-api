import { getLiveKitClientWebSocketUrl } from "@/lib/livekit/env";
import { createDefaultRoomName, createLiveKitUserToken } from "@/lib/livekit/tokens";
import { LiveKitConnectClient } from "./LiveKitConnectClient";

export const dynamic = "force-dynamic";

function safeRandomIdentity() {
  const id = crypto.randomUUID().replaceAll("-", "");
  return `web_${id.slice(0, 16)}`;
}

export default async function LiveKitExamplePage() {
  const wsUrl = getLiveKitClientWebSocketUrl();
  const roomName = createDefaultRoomName("pi_livekit");
  const identity = safeRandomIdentity();

  const token = await createLiveKitUserToken({
    room: roomName,
    identity,
    name: "Pi LiveKit Example (web)",
    ttlSeconds: 60 * 10,
    metadata: JSON.stringify({ source: "internal-livekit-example" }),
  });

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-semibold tracking-tight">LiveKit connection example</h1>
      <p className="mt-2 max-w-prose text-gray-600">
        Internal-only page that mints a short-lived LiveKit token server-side and validates a browser connection using{" "}
        <code className="rounded bg-gray-100 px-1 py-0.5 text-sm">livekit-client</code>.
      </p>

      <div className="mt-4 rounded-lg border bg-gray-50 p-4 text-sm">
        <div>
          <span className="font-medium">LIVEKIT_URL</span>: <code>{wsUrl}</code>
        </div>
        <div className="mt-1 text-gray-600">
          Ensure <code>LIVEKIT_API_KEY</code> and <code>LIVEKIT_API_SECRET</code> are set on the server for token minting.
        </div>
      </div>

      <LiveKitConnectClient wsUrl={wsUrl} token={token} identity={identity} roomName={roomName} />
    </main>
  );
}

