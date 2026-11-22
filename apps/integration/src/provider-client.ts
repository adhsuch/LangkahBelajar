export type ProviderErrorCode = "TIMEOUT" | "RATE_LIMITED" | "UPSTREAM_ERROR" | "UNREACHABLE" | "INVALID_RESPONSE";

export class ProviderError extends Error {
  constructor(
    readonly code: ProviderErrorCode,
    readonly httpStatus?: number,
  ) {
    super(code);
  }
}

export interface ProviderOptions {
  name: string;
  baseUrl: string;
  apiKey?: string;
  timeoutMs: number;
  retries: number;
  retryDelayMs?: number;
  log?: (event: string, fields: Record<string, unknown>) => void;
}

const DEFAULT_RATE_LIMIT_SECONDS = 30;

export class ProviderClient {
  private blockedUntil = 0;
  lastSuccessAt: string | null = null;
  lastError: ProviderErrorCode | null = null;

  constructor(readonly options: ProviderOptions) {}

  get rateLimitedUntil() {
    return this.blockedUntil > Date.now() ? new Date(this.blockedUntil).toISOString() : null;
  }

  /** GET with timeout and bounded retries. A 429 is never retried and pauses calls until Retry-After. */
  async get(path: string, params: Record<string, string>): Promise<unknown> {
    if (this.blockedUntil > Date.now()) throw this.fail(new ProviderError("RATE_LIMITED", 429));
    const url = new URL(path, this.options.baseUrl);
    url.search = new URLSearchParams(params).toString();

    let lastError = new ProviderError("UNREACHABLE");
    for (let attempt = 0; attempt <= this.options.retries; attempt += 1) {
      if (attempt > 0) await new Promise((done) => setTimeout(done, (this.options.retryDelayMs ?? 200) * attempt));
      const startedAt = Date.now();
      try {
        const data = await this.request(url);
        this.options.log?.("provider_call", { provider: this.options.name, outcome: "OK", attempt, durationMs: Date.now() - startedAt });
        this.lastSuccessAt = new Date().toISOString();
        this.lastError = null;
        return data;
      } catch (error) {
        lastError = error instanceof ProviderError ? error : new ProviderError("UNREACHABLE");
        this.options.log?.("provider_call", { provider: this.options.name, outcome: "ERROR", code: lastError.code, httpStatus: lastError.httpStatus, attempt, durationMs: Date.now() - startedAt });
        if (lastError.code === "RATE_LIMITED" || lastError.code === "INVALID_RESPONSE") break;
      }
    }
    throw this.fail(lastError);
  }

  private fail(error: ProviderError) {
    this.lastError = error.code;
    return error;
  }

  private async request(url: URL) {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: this.options.apiKey ? { "x-api-key": this.options.apiKey } : {},
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
    } catch (error) {
      throw new ProviderError(error instanceof DOMException && error.name === "TimeoutError" ? "TIMEOUT" : "UNREACHABLE");
    }
    if (response.status === 429) {
      const seconds = Number(response.headers.get("retry-after"));
      this.blockedUntil = Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_RATE_LIMIT_SECONDS) * 1000;
      throw new ProviderError("RATE_LIMITED", 429);
    }
    if (response.status >= 500) throw new ProviderError("UPSTREAM_ERROR", response.status);
    if (!response.ok) throw new ProviderError("INVALID_RESPONSE", response.status);
    try {
      return await response.json();
    } catch {
      throw new ProviderError("INVALID_RESPONSE", response.status);
    }
  }
}
