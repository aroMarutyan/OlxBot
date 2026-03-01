import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@aws-sdk/client-dynamodb', () => {
  const send = vi.fn();
  const DynamoDBClient = vi.fn(function () {
    return { send };
  });
  const ScanCommand = vi.fn(function (input) {
    return { input };
  });
  const UpdateItemCommand = vi.fn(function (input) {
    return { input };
  });

  return {
    DynamoDBClient,
    ScanCommand,
    UpdateItemCommand,
    __mocks: { send }
  };
});

vi.mock('@aws-sdk/util-dynamodb', () => ({
  unmarshall: vi.fn(item => ({ ...item, unmarshalled: true })),
  marshall: vi.fn(item => item)
}));

describe('db-crud-service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.TABLE_NAME = 'searches-table';
  });

  it('scans searches and unmarshalls returned items', async () => {
    const { __mocks, ScanCommand } = await import('@aws-sdk/client-dynamodb');
    const { unmarshall } = await import('@aws-sdk/util-dynamodb');
    const { getSearches } = await import('../../src/services/db-crud.service.js');

    __mocks.send.mockResolvedValue({
      Items: [{ searchId: 'a' }, { searchId: 'b' }]
    });

    const searches = await getSearches();

    expect(ScanCommand).toHaveBeenCalledWith({
      TableName: 'searches-table',
      ConsistentRead: true
    });
    expect(unmarshall).toHaveBeenCalledTimes(2);
    expect(searches).toEqual([
      { searchId: 'a', unmarshalled: true },
      { searchId: 'b', unmarshalled: true }
    ]);
  });

  it('updates newest offer field with remapped offer data', async () => {
    const { __mocks, UpdateItemCommand } = await import('@aws-sdk/client-dynamodb');
    const { marshall } = await import('@aws-sdk/util-dynamodb');
    const { updateSearchData } = await import('../../src/services/db-crud.service.js');

    const newestResult = {
      id: 'offer-1',
      url: 'https://www.olx.bg/d/ad/my-offer',
      title: 'Road Bike',
      description: 'Great condition',
      last_refresh_time: '2026-03-01T10:00:00+02:00',
      photos: [{ link: 'photo-link' }],
      params: [{ key: 'price', value: { value: 195.58, currency: 'BGN' } }],
      location: {
        city: { name: 'Barcelona' },
        district: { name: 'Center' },
        region: { name: 'Catalonia' }
      }
    };

    await updateSearchData('search-1', newestResult);

    expect(marshall).toHaveBeenCalledWith({ searchId: 'search-1' });
    expect(marshall).toHaveBeenCalledWith(expect.objectContaining({
      ':VAL': expect.objectContaining({
        imageUrl: 'photo-link',
        title: 'Road Bike',
        price: expect.closeTo(100, 10),
        description: 'Great condition',
        location: { city: 'Barcelona', district: 'Center', region: 'Catalonia' },
        link: 'https://www.olx.bg/d/ad/my-offer',
        offerId: 'offer-1',
        modified: '2026-03-01T10:00:00+02:00'
      })
    }));
    expect(UpdateItemCommand).toHaveBeenCalledTimes(1);
    expect(__mocks.send).toHaveBeenCalledTimes(1);
  });

  it('throws when DynamoDB scan fails in getSearches', async () => {
    const { __mocks } = await import('@aws-sdk/client-dynamodb');
    const { getSearches } = await import('../../src/services/db-crud.service.js');

    __mocks.send.mockRejectedValue(new Error('ddb down'));

    await expect(getSearches()).rejects.toThrow('ddb down');
  });

  it('throws when DynamoDB update fails in updateSearchData', async () => {
    const { __mocks } = await import('@aws-sdk/client-dynamodb');
    const { updateSearchData } = await import('../../src/services/db-crud.service.js');

    __mocks.send.mockRejectedValue(new Error('update failed'));

    const newestResult = {
      id: 'offer-1',
      url: 'https://www.olx.bg/d/ad/slug',
      title: 'T',
      description: 'D',
      last_refresh_time: '2026-03-01T08:00:00+02:00',
      photos: [{ link: 'img' }],
      params: [{ key: 'price', value: { value: 10, currency: 'EUR' } }],
      location: { city: { name: 'C' }, district: { name: '' }, region: { name: 'R' } }
    };

    await expect(updateSearchData('s1', newestResult)).rejects.toThrow('update failed');
  });
});
