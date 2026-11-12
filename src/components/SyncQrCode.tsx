import { useEffect, useState } from "react";

interface Props {
  id: string;
  /** What the code carries: the join link. */
  text: string;
  /** Its accessible name: what it is and what to do with it. */
  label: string;
}

/**
 * The join link as a QR code, for a phone's camera to read off this screen.
 * The encoder loads only when a code is first shown. A code is dark on light
 * in both themes, with a four-module quiet zone, or cameras miss it.
 */
export function SyncQrCode({ id, text, label }: Props) {
  const [modules, setModules] = useState<boolean[][] | null>(null);
  useEffect(() => {
    let live = true;
    void import("uqr").then(({ encode }) => {
      if (live) setModules(encode(text, { ecc: "M", border: 4 }).data);
    });
    return () => {
      live = false;
    };
  }, [text]);

  if (!modules) return <div id={id} className="sync-qr" aria-busy="true" />;
  const size = modules.length;
  return (
    <svg id={id} className="sync-qr" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <path d={modulePath(modules)} fill="currentColor" />
    </svg>
  );
}

/** One path for all dark modules, a run of neighbours in a row drawn as one rectangle. */
function modulePath(modules: boolean[][]): string {
  let d = "";
  modules.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < row.length && row[x]) x++;
      d += `M${start} ${y}h${x - start}v1h${start - x}z`;
    }
  });
  return d;
}
