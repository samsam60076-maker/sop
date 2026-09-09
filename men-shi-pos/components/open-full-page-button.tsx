"use client";

import { useEffect, useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export function OpenFullPageButton() {
  const [publicUrl, setPublicUrl] = useState("");
  const [here, setHere] = useState("");

  useEffect(() => {
    setHere(window.location.origin);
    void fetch("/api/public-url")
      .then((response) => response.json())
      .then((data: { url?: string }) => {
        if (data.url) setPublicUrl(data.url.replace(/\/$/, ""));
      })
      .catch(() => {});
  }, []);

  const url = publicUrl || (here.startsWith("http") && !here.includes("127.0.0.1") && !here.includes("localhost") ? here : "");

  if (!url) return null;

  const alreadyThere = here.replace(/\/$/, "") === url;
  if (alreadyThere) return null;

  return (
    <div className="flex items-center gap-1">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 hover:bg-sidebar-accent"
      >
        <ExternalLink className="size-3.5" />
        網頁
      </a>
      <button
        type="button"
        className="inline-flex h-7 items-center rounded-md px-1.5 hover:bg-sidebar-accent"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            toast.success("已複製網址");
          } catch {
            toast.message(url);
          }
        }}
      >
        <Copy className="size-3.5" />
      </button>
    </div>
  );
}
