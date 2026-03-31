export class NextRequest extends Request {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(input, init);
  }

  get nextUrl(): URL {
    return new URL(this.url);
  }
}

export class NextResponse extends Response {
  static json(data: unknown, init: ResponseInit = {}): NextResponse {
    const headers = new Headers(init.headers);
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    return new NextResponse(JSON.stringify(data), {
      ...init,
      headers
    });
  }
}
