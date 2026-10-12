import type { ApiErrorPayload } from '../types';

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly errorPayload: ApiErrorPayload;

  constructor(status: number, errorPayload: ApiErrorPayload) {
    super(errorPayload.message || 'API request failed');
    this.name = 'ApiClientError';
    this.status = status;
    this.errorPayload = errorPayload;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

class ApiClient {
  private baseUrl: string;
  private tokenProvider?: () => string | null;

  constructor(baseUrl = '/api/v1') {
    this.baseUrl = baseUrl;
  }

  public setTokenProvider(provider: () => string | null) {
    this.tokenProvider = provider;
  }

  private buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
    let cleanPath = path.startsWith('/') ? path : `/${path}`;
    if (cleanPath.startsWith(this.baseUrl)) {
      cleanPath = cleanPath.slice(this.baseUrl.length);
      if (!cleanPath.startsWith('/')) cleanPath = `/${cleanPath}`;
    }
    const url = new URL(`${this.baseUrl}${cleanPath}`, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    return url.pathname + url.search;
  }

  public async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(path, options.params);
    const headers = new Headers(options.headers);

    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    // Prepare auth token interceptor for future phases
    if (this.tokenProvider) {
      const token = this.tokenProvider();
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (networkError) {
      const offlinePayload: ApiErrorPayload = {
        timestamp: new Date().toISOString(),
        status: 0,
        error: 'NETWORK_ERROR',
        message: 'Could not connect to the SRATS backend service. Please check connectivity.',
        path: url,
        traceId: 'client-offline',
      };
      throw new ApiClientError(0, offlinePayload);
    }

    if (!response.ok) {
      // Transparent token refresh interceptor on 401
      if (
        response.status === 401 &&
        !path.includes('/auth/login') &&
        !path.includes('/auth/refresh') &&
        !path.includes('/auth/register') &&
        !(options as any)._isRetry
      ) {
        const storedRefreshToken = sessionStorage.getItem('srats_refresh_token');
        if (storedRefreshToken) {
          try {
            const refreshUrl = this.buildUrl('/auth/refresh');
            const refreshRes = await fetch(refreshUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken: storedRefreshToken }),
            });

            if (refreshRes.ok) {
              const refreshData = await refreshRes.json();
              sessionStorage.setItem('srats_access_token', refreshData.accessToken);
              sessionStorage.setItem('srats_refresh_token', refreshData.refreshToken);

              // Retry original request with newly issued token
              const retryHeaders = new Headers(options.headers);
              if (!retryHeaders.has('Content-Type') && !(options.body instanceof FormData)) {
                retryHeaders.set('Content-Type', 'application/json');
              }
              retryHeaders.set('Authorization', `Bearer ${refreshData.accessToken}`);

              const retryResponse = await fetch(url, {
                ...options,
                headers: retryHeaders,
              });

              if (retryResponse.ok) {
                if (retryResponse.status === 204) {
                  return null as T;
                }
                return (await retryResponse.json()) as T;
              }
            } else {
              sessionStorage.removeItem('srats_access_token');
              sessionStorage.removeItem('srats_refresh_token');
              window.dispatchEvent(new CustomEvent('srats:session-expired'));
            }
          } catch {
            // Fall through to error throwing below
          }
        }
      }

      let errorPayload: ApiErrorPayload;
      try {
        errorPayload = await response.json();
      } catch {
        errorPayload = {
          timestamp: new Date().toISOString(),
          status: response.status,
          error: response.statusText || 'HTTP_ERROR',
          message: `Server returned HTTP status ${response.status}`,
          path: url,
          traceId: response.headers.get('X-Trace-Id') || 'unknown',
        };
      }
      throw new ApiClientError(response.status, errorPayload);
    }

    // Check if 204 No Content
    if (response.status === 204) {
      return null as T;
    }

    return (await response.json()) as T;
  }

  public get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  public post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  public put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  public delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }

  public async download(path: string, options: RequestOptions = {}): Promise<{ blob: Blob; fileName: string }> {
    const url = this.buildUrl(path, options.params);
    const headers = new Headers(options.headers);
    if (this.tokenProvider) {
      const token = this.tokenProvider();
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }
    const response = await fetch(url, { ...options, headers, method: 'GET' });
    if (!response.ok) {
      let errorPayload: ApiErrorPayload;
      try {
        errorPayload = await response.json();
      } catch {
        errorPayload = {
          timestamp: new Date().toISOString(),
          status: response.status,
          error: response.statusText || 'HTTP_ERROR',
          message: `Server returned HTTP status ${response.status}`,
          path: url,
          traceId: response.headers.get('X-Trace-Id') || 'unknown',
        };
      }
      throw new ApiClientError(response.status, errorPayload);
    }

    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition');
    let fileName = 'downloaded_file';
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) {
        fileName = match[1];
      }
    }
    return { blob, fileName };
  }
}

export const apiClient = new ApiClient();
