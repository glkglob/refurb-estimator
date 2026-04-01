export class NextRequest extends Request {
  get nextUrl(): URL {
    return new URL(this.url);
  }
}

type JsonResponseInit = {
  status?: number;
  headers?: HeadersInit;
};

type MockJsonResponse<T> = {
  status: number;
  headers: Headers;
  json: () => Promise<T>;
};

export const NextResponse = {
  json<T>(data: T, init?: JsonResponseInit): MockJsonResponse<T> {
    const headers = new Headers(init?.headers);

    return {
      status: init?.status ?? 200,
      headers,
      json: async () => data
    };
  }
};
