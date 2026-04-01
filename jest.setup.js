require('@testing-library/jest-dom');

const fetch = require('cross-fetch');

global.fetch = fetch;
global.Headers = fetch.Headers;
global.Request = fetch.Request;
global.Response = fetch.Response;
