export async function isImageReachable(url: string): Promise<boolean> {
  if (!url) return false;

  try {
    const headResponse = await fetch(url, { method: "HEAD" });
    if (headResponse.ok) return true;

    // Some CDNs disallow HEAD but allow GET.
    const getResponse = await fetch(url, { method: "GET" });
    return getResponse.ok;
  } catch {
    return false;
  }
}
