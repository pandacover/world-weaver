export type OpenRouterConfig = {
  apiKey: string;
  siteUrl?: string;
  appTitle?: string;
};

export class OpenRouterError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

export function openRouterHeaders(config: OpenRouterConfig): HeadersInit {
  return {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": config.siteUrl ?? "http://localhost:3000",
    "X-Title": config.appTitle ?? "World Weaver",
  };
}

export async function openRouterFetch(
  config: OpenRouterConfig,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = path.startsWith("http")
    ? path
    : `https://openrouter.ai/api/v1${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      ...openRouterHeaders(config),
      ...(init?.headers ?? {}),
    },
  });
  return response;
}

export async function readErrorBody(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 2000);
  } catch {
    return response.statusText;
  }
}
