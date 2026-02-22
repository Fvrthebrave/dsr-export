export async function retryWithBackoff<T>(
  fn: () => Promise<T>, // Expects a function that returns a promise
  maxAttempts = 3,
  baseDelayMs = 500
): Promise<T> {
  let attempt = 0;

  while(true) {
    try {
      return await fn();
    } catch(err) {
      attempt++;

      if(attempt >= maxAttempts) {
        throw err;
      }

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}