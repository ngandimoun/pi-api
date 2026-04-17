import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 32,
  height: 32,
};

export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 8,
          boxShadow: "inset 0 0 0 1px rgba(148,163,184,0.18)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 7,
            background:
              "radial-gradient(circle at 30% 25%, rgba(59,130,246,0.95), rgba(16,185,129,0.75) 55%, rgba(2,6,23,1) 100%)",
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              lineHeight: 1,
              color: "rgba(255,255,255,0.95)",
              transform: "translateY(0.5px)",
            }}
          >
            π
          </div>
        </div>
      </div>
    ),
    {
      width: size.width,
      height: size.height,
    }
  );
}

