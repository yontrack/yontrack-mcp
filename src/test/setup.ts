// Must run before any module that imports src/config.ts,
// which calls process.exit(1) if these vars are absent.
process.env.YONTRACK_URL = "https://yontrack.example.com";
process.env.YONTRACK_TOKEN = "test-token";
