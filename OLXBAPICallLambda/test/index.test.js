import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/api-call.service.js', () => ({
  request: vi.fn()
}));
vi.mock('../src/services/telegram-bot.service.js', () => ({
  sendResultsToTelegram: vi.fn()
}));
vi.mock('../src/services/db-crud.service.js', () => ({
  getSearches: vi.fn(),
  updateSearchData: vi.fn()
}));
vi.mock('../src/services/api-call-error-handler.service.js', () => ({
  ERROR_SEARCHES_ARRAY: [],
  displayCurrentInstanceErrors: vi.fn()
}));

import { handler } from '../index.js';
import { request } from '../src/services/api-call.service.js';
import { getSearches, updateSearchData } from '../src/services/db-crud.service.js';
import { sendResultsToTelegram } from '../src/services/telegram-bot.service.js';
import { displayCurrentInstanceErrors } from '../src/services/api-call-error-handler.service.js';

describe('handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes only active searches and returns a successful response', async () => {
    getSearches.mockResolvedValue([
      { searchId: 'active-1', alias: 'a', active: true },
      { searchId: 'inactive-1', alias: 'b', active: false }
    ]);
    request.mockResolvedValue([]);

    const response = await handler();

    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith({ searchId: 'active-1', alias: 'a', active: true });
    expect(updateSearchData).not.toHaveBeenCalled();
    expect(sendResultsToTelegram).not.toHaveBeenCalled();
    expect(displayCurrentInstanceErrors).toHaveBeenCalledTimes(1);
    expect(response).toEqual({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true })
    });
  });

  it('sends sorted newest results and limits payload to five entries', async () => {
    getSearches.mockResolvedValue([
      {
        searchId: 'active-2',
        alias: 'search-2',
        active: true,
        newestOffer: { offerId: 'known-offer', modified: '2026-03-01T10:00:00+02:00' }
      }
    ]);

    request.mockResolvedValue([
      { id: 'known-offer', last_refresh_time: '2026-03-01T10:00:00+02:00' },
      { id: 'offer-2', last_refresh_time: '2026-03-01T12:10:00+02:00' },
      { id: 'offer-3', last_refresh_time: '2026-03-01T11:50:00+02:00' },
      { id: 'offer-4', last_refresh_time: '2026-03-01T13:00:00+02:00' },
      { id: 'offer-5', last_refresh_time: '2026-03-01T12:50:00+02:00' },
      { id: 'offer-6', last_refresh_time: '2026-03-01T12:00:00+02:00' },
      { id: 'offer-7', last_refresh_time: '2026-03-01T14:00:00+02:00' },
      { id: 'highlighted-offer', last_refresh_time: '2026-03-01T15:00:00+02:00', promotion: { highlighted: true } },
      { id: 'old-offer', last_refresh_time: '2026-03-01T09:59:00+02:00' }
    ]);

    await handler();

    expect(updateSearchData).toHaveBeenCalledTimes(1);
    const updateArgs = updateSearchData.mock.calls[0];
    expect(updateArgs[0]).toBe('active-2');
    expect(updateArgs[1].id).toBe('offer-7');

    expect(sendResultsToTelegram).toHaveBeenCalledTimes(1);
    const sentResults = sendResultsToTelegram.mock.calls[0][0];
    expect(sentResults.map(item => item.id)).toEqual(['offer-7', 'offer-4', 'offer-5', 'offer-2', 'offer-6']);
  });

  it('returns only the first result when newestOfferId is not found in results', async () => {
    getSearches.mockResolvedValue([
      {
        searchId: 'active-3',
        alias: 'search-3',
        active: true,
        newestOffer: { offerId: 'missing-offer', modified: '2026-03-01T08:00:00+02:00' }
      }
    ]);

    request.mockResolvedValue([
      { id: 'new-offer-1', last_refresh_time: '2026-03-01T12:00:00+02:00' },
      { id: 'new-offer-2', last_refresh_time: '2026-03-01T13:00:00+02:00' }
    ]);

    await handler();

    expect(updateSearchData).toHaveBeenCalledTimes(1);
    expect(updateSearchData.mock.calls[0][1].id).toBe('new-offer-1');

    expect(sendResultsToTelegram).toHaveBeenCalledTimes(1);
    expect(sendResultsToTelegram.mock.calls[0][0]).toEqual([{ id: 'new-offer-1', last_refresh_time: '2026-03-01T12:00:00+02:00' }]);
  });

  it('does not send results when all items are older than or equal to the last modified date', async () => {
    getSearches.mockResolvedValue([
      {
        searchId: 'active-4',
        alias: 'search-4',
        active: true,
        newestOffer: { offerId: 'known-offer', modified: '2026-03-01T10:00:00+02:00' }
      }
    ]);

    request.mockResolvedValue([
      { id: 'known-offer', last_refresh_time: '2026-03-01T10:00:00+02:00' },
      { id: 'old-offer', last_refresh_time: '2026-03-01T09:00:00+02:00' }
    ]);

    await handler();

    expect(updateSearchData).not.toHaveBeenCalled();
    expect(sendResultsToTelegram).not.toHaveBeenCalled();
  });

  it('updates and sends when search has no prior newestOffer', async () => {
    getSearches.mockResolvedValue([
      { searchId: 'new-search', alias: 'first-time', active: true }
    ]);

    request.mockResolvedValue([
      { id: 'first-result', last_refresh_time: '2026-03-01T10:00:00+02:00' }
    ]);

    await handler();

    expect(updateSearchData).toHaveBeenCalledTimes(1);
    expect(updateSearchData.mock.calls[0][1].id).toBe('first-result');
    expect(sendResultsToTelegram).toHaveBeenCalledTimes(1);
    expect(sendResultsToTelegram.mock.calls[0][0]).toEqual([{ id: 'first-result', last_refresh_time: '2026-03-01T10:00:00+02:00' }]);
  });
});
