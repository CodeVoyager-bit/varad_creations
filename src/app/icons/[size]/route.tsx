import { ImageResponse } from "next/og";

export const generateStaticParams = () => [{ size: "192" }, { size: "512" }];

/** Temporary app icon (V monogram); replace with the real logo when available. */
export async function GET(_: Request, { params }: RouteContext<"/icons/[size]">) {
  const size = (await params).size === "192" ? 192 : 512;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#861c30", color: "#fbf5ea", fontSize: size * 0.56, fontWeight: 700, fontFamily: "serif" }}>
        V
      </div>
    ),
    { width: size, height: size },
  );
}
