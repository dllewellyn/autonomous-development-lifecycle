import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// Custom error classes
export class FetchError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'FetchError';
  }
}

export class PageNotFoundError extends FetchError {
  constructor(message: string) {
    super(message, 404);
    this.name = 'PageNotFoundError';
  }
}

export interface WikipediaFetcherConfig {
  baseURL?: string;
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

export class WikipediaFetcher {
  private axiosInstance: AxiosInstance;
  private readonly config: Required<WikipediaFetcherConfig>;

  constructor(config?: WikipediaFetcherConfig) {
    this.config = {
      baseURL: config?.baseURL || 'https://en.wikipedia.org/wiki/',
      retries: config?.retries || 3,
      retryDelayMs: config?.retryDelayMs || 1000,
      timeoutMs: config?.timeoutMs || 10000,
    };

    this.axiosInstance = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeoutMs,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', // Good practice for web scraping
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error: AxiosError) => {
        const { config, response } = error;
        const status = response?.status;

        // Only retry for network errors or 5xx status codes
        if (!config || !this.shouldRetry(status, error)) { // Pass the full error object
          return Promise.reject(this.handleError(error));
        }

        (config as any).retriesLeft = (config as any).retriesLeft === undefined ? this.config.retries : (config as any).retriesLeft - 1;

        if ((config as any).retriesLeft > 0) {
          const delay = this.config.retryDelayMs * (this.config.retries - (config as any).retriesLeft);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.axiosInstance(config);
        }

        return Promise.reject(this.handleError(error));
      }
    );
  }

  private shouldRetry(status?: number, error?: AxiosError): boolean {
    // Retry on network errors (e.g., 'ECONNREFUSED', 'ETIMEDOUT')
    if (error && axios.isAxiosError(error) && (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT')) {
      return true;
    }
    // Retry on 5xx status codes
    return status !== undefined && status >= 500 && status < 600;
  }

  private handleError(error: AxiosError): Error {
    if (error.response) {
      // Server responded with a status other than 2xx
      if (error.response.status === 404) {
        return new PageNotFoundError(`Page not found at ${error.config?.url}`);
      }
      return new FetchError(
        `Request failed with status ${error.response.status}: ${error.response.statusText}`,
        error.response.status
      );
    } else if (error.request) {
      // Request was made but no response received
              return new FetchError(`No response received from ${error.config?.url}`);    } else {
      // Something happened in setting up the request that triggered an Error
      return new FetchError(`Error setting up request: ${error.message}`);
    }
  }

  /**
   * Fetches the HTML content of a Wikipedia page.
   * @param pageTitle The title of the Wikipedia page (e.g., "The_Traitors_(British_series_1)").
   * @returns A Promise that resolves with the HTML content as a string.
   * @throws {PageNotFoundError} If the page is not found (404 status).
   * @throws {FetchError} For other network or HTTP errors.
   */
  public async fetchPage(pageTitle: string): Promise<string> {
    try {
      const response: AxiosResponse<string> = await this.axiosInstance.get(pageTitle);
      return response.data;
    } catch (error: any) {
      // The interceptor already handles error transformation, so we just re-throw
      throw error;
    }
  }
}
