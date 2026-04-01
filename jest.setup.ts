import "whatwg-fetch";
import "@testing-library/jest-dom";

beforeAll(() => {
	// eslint-disable-next-line no-console
	console.log("TEST_SUITE_EXECUTED");
});

beforeEach(() => {
	expect.hasAssertions();
});
