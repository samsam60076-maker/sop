import { readFile } from "node:fs/promises";

const PUBLIC_URL_FILE = "/tmp/pos-public-url.txt";

export async function GET() {
  try {
    const url = (await readFile(PUBLIC_URL_FILE, "utf8")).trim();
    if (!/^https?:\/\//.test(url)) {
      return Response.json({ url: "" });
    }
    return Response.json({ url });
  } catch {
    return Response.json({ url: "" });
  }
}
