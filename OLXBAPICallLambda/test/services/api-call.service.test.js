import { beforeEach, describe, expect, it, vi } from 'vitest';
import { firstCall } from '../../src/services/api-call.service.js';
import { ERROR_SEARCHES_ARRAY } from '../../src/services/api-call-error-handler.service.js';

const createSearch = (overrides = {}) => ({
  alias: 'mountain-bike',
  searchTerm: 'bike',
  minPrice: '50',
  maxPrice: '300',
  range: '30',
  condition: new Set(['new', 'as_good_as_new']),
  ...overrides
});

describe('firstCall', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    ERROR_SEARCHES_ARRAY.length = 0;
  });

  it('returns first page items and builds search URL with filters', async () => {
    const items = [{ id: '1' }];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: { clientCompatibleListings: { data: items } }
      })
    });

    vi.stubGlobal('fetch', fetchMock);

    const search = createSearch();
    const result = await firstCall(search);

    expect(result).toEqual(items);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [calledUrl, fetchOptions] = fetchMock.mock.calls[0];
    expect(calledUrl.href).toBe('https://www.olx.bg/apigateway/graphql');
    expect(fetchOptions.method).toBe('POST');

    const calledBody = JSON.parse(fetchOptions.body);
    expect(calledBody.variables.searchParameters).toEqual(expect.arrayContaining([
      { key: 'query', value: 'bike' },
      { key: 'sort_by', value: 'created_at:desc' },
      { key: 'filter_float_price:from', value: '50' },
      { key: 'filter_float_price:to', value: '300' },
      { key: 'filter_enum_state[0]', value: 'new' },
      { key: 'filter_enum_state[1]', value: 'as_good_as_new' }
    ]));
  });

  it('records fetch and first call errors when the API call fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);

    const result = await firstCall(createSearch());

    expect(result).toEqual([]);
    expect(ERROR_SEARCHES_ARRAY).toHaveLength(2);
    expect(ERROR_SEARCHES_ARRAY[0]).toMatchObject({ alias: 'mountain-bike', errorType: 'fetch', errorCode: 500 });
    expect(ERROR_SEARCHES_ARRAY[1]).toMatchObject({ alias: 'mountain-bike', errorType: 'first call', errorCode: 'N/A' });
  });

  it('returns empty array when first page has no items and no next page', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: { clientCompatibleListings: { data: [] } }
      })
    });

    vi.stubGlobal('fetch', fetchMock);

    const result = await firstCall(createSearch({ condition: new Set(['']) }));

    expect(result).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('omits optional URL params when search has no minPrice, maxPrice, or range', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: { clientCompatibleListings: { data: [{ id: '1' }] } }
      })
    });

    vi.stubGlobal('fetch', fetchMock);

    const search = createSearch({ minPrice: '', maxPrice: '', range: '', condition: new Set(['']) });
    await firstCall(search);

    const fetchOptions = fetchMock.mock.calls[0][1];
    const calledBody = JSON.parse(fetchOptions.body);
    const bodyParams = calledBody.variables.searchParameters;
    expect(bodyParams.find(param => param.key === 'filter_float_price:from')).toBeUndefined();
    expect(bodyParams.find(param => param.key === 'filter_float_price:to')).toBeUndefined();
    expect(bodyParams.find(param => param.key.startsWith('filter_enum_state['))).toBeUndefined();
  });
});
