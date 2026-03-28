"use client";

import { useCallback, useMemo, useState } from "react";
import { Room, RoomEvent } from "livekit-client";

type Props = {
  wsUrl: string;
  token: string;
  identity: string;
  roomName: string;
};

export function LiveKitConnectClient({ wsUrl, token, identity, roomName }: Props) {
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "disconnected" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  const room = useMemo(() => {
    const r = new Room();
    r.on(RoomEvent.Connected, () => setStatus("connected"));
    r.on(RoomEvent.Disconnected, () => setStatus("disconnected"));
    r.on(RoomEvent.ConnectionStateChanged, (state) => {
      if (state === "connecting") setStatus("connecting");
    });
    return r;
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    setStatus("connecting");
    try {
      await room.connect(wsUrl, token);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Failed to connect");
    }
  }, [room, token, wsUrl]);

  const disconnect = useCallback(() => {
    room.disconnect();
  }, [room]);

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-lg border bg-white p-4">
        <div className="grid gap-2 text-sm">
          <div>
            <span className="font-medium">Room</span>: <code>{roomName}</code>
          </div>
          <div>
            <span className="font-medium">Identity</span>: <code>{identity}</code>
          </div>
          <div>
            <span className="font-medium">Status</span>: <code>{status}</code>
          </div>
          {error ? (
            <div className="text-red-600">
              <span className="font-medium">Error</span>: {error}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={connect}
          disabled={status === "connecting" || status === "connected"}
          className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Connect
        </button>
        <button
          type="button"
          onClick={disconnect}
          disabled={status !== "connected" && status !== "connecting"}
          className="rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          Disconnect
        </button>
      </div>

      <p className="text-sm text-gray-600">
        This page only validates the LiveKit transport connection. Voice-agent media (mic/audio publish) will be added
        when we wire an agent runtime (LiveKit Agents or our own bridge) in a follow-up step.
      </p>
    </div>
  );
}

