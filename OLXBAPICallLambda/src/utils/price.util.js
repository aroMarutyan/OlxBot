const BGN_TO_EUR_RATE = 1.9558;

export function getPriceInEurFromParams(params) {
  const price = params?.find(param => param.key === 'price')?.value;
  if (!price) return undefined;
  return price.currency === 'BGN' ? price.value / BGN_TO_EUR_RATE : price.value;
}
