export class TimeoutError extends Error {
  constructor(message = "Tempo limite excedido") {
    super(message);
    this.name = "TimeoutError";
  }
}

export class MalformedResponseError extends Error {
  constructor(message = "Resposta inesperada") {
    super(message);
    this.name = "MalformedResponseError";
  }
}

export async function withAbortTimeout<T>(
  timeoutMs: number,
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new TimeoutError());
    }, Math.max(0, timeoutMs));
  });
  try {
    return await Promise.race([fn(controller.signal), timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
