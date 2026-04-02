import "whatwg-fetch";
import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "util";

Object.defineProperty(globalThis, "TextEncoder", {
	value: TextEncoder,
	writable: true,
	configurable: true
});

Object.defineProperty(globalThis, "TextDecoder", {
	value: TextDecoder,
	writable: true,
	configurable: true
});

beforeAll(() => {
	// eslint-disable-next-line no-console
	console.log("TEST_SUITE_EXECUTED");
});

beforeEach(() => {
	expect.hasAssertions();
});
