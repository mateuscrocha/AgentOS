let installed = false;

export function installConsoleErrorNoiseFilter() {
  if (installed) return;
  if (typeof console === "undefined" || typeof console.error !== "function") return;

  const originalConsoleError = console.error.bind(console);

  console.error = (...args: any[]) => {
    if (args.length === 0) return;
    const joined = args.map((a) => String(a)).join(" ");

    // Filter known abort/resource noise while preserving actionable errors.
    if (
      joined.includes("net::ERR_ABORTED") ||
      joined.includes("AbortError") ||
      joined.includes("net::ERR_INSUFFICIENT_RESOURCES")
    ) {
      return;
    }

    originalConsoleError(...args);
  };

  installed = true;
}
