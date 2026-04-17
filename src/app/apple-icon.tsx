import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: size.width,
          height: size.height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#020617",
        }}
      >
        <div
          style={{
            width: 148,
            height: 148,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 44,
            background:
              "radial-gradient(circle at 30% 25%, rgba(59,130,246,0.95), rgba(16,185,129,0.78) 55%, rgba(2,6,23,1) 100%)",
            boxShadow:
              "0 24px 60px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(148,163,184,0.18)",
          }}
        >
          <div
            style={{
              fontSize: 104,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: -6,
              color: "rgba(255,255,255,0.96)",
              transform: "translateY(-2px)",
              textShadow: "0 12px 28px rgba(0,0,0,0.45)",
            }}
          >
            π
          </div>
        </div>
      </div>
    ),
    { width: size.width, height: size.height }
  );
}

