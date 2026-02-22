export type QuickBooksPayload = {
  storeId: string,
  reportDate: string,
  totalSales: number,
  tax: number,
  idempotencyKey: string
}

export async function sendToQuickbooks({
  storeId,
  reportDate,
  totalSales,
  tax,
  idempotencyKey
}: QuickBooksPayload) {
  console.log("Simulating Quickbooks API call...");

  await new Promise(resolve => setTimeout(resolve, 500));

  if(Math.random() < 0.7) {
    console.log('Simulated QB failure');
    throw new Error('Simulated QB failure');
  }

  return {
    qbTransactionId: `QB-${Date.now()}`
  };
}