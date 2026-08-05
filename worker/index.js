const injectRequestOrigin = async (response, request) => {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") || request.method === "HEAD") return response;

  const html = await response.text();
  if (!html.includes("__WARHOST_ORIGIN__")) return new Response(html, response);

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(html.replaceAll("__WARHOST_ORIGIN__", new URL(request.url).origin), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");

    if (response.status !== 404 || !acceptsHtml || !["GET", "HEAD"].includes(request.method)) {
      return injectRequestOrigin(response, request);
    }

    const indexUrl = new URL(request.url);
    indexUrl.pathname = "/index.html";
    indexUrl.search = "";
    const fallback = await env.ASSETS.fetch(new Request(indexUrl, request));
    return injectRequestOrigin(fallback, request);
  },
};
