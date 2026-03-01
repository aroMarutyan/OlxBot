import { request } from './src/services/api-call.service.js';
import { sendResultsToTelegram } from './src/services/telegram-bot.service.js';
import { getSearches, updateSearchData } from './src/services/db-crud.service.js';
import { ERROR_SEARCHES_ARRAY, displayCurrentInstanceErrors } from './src/services/api-call-error-handler.service.js';

const MAX_NUMBER_OF_RESULTS = 5;

export const handler = async () => {

  const searches = (await getSearches()).filter(search => search.active);

  for (const search of searches) {
    const results = await request(search);
    await handleResults(search, results);
  }

  await displayCurrentInstanceErrors();

  return finalizeLambda();
};

async function handleResults(search, results) {
  const nonHighlightedResults = results.filter(result => !result?.promotion?.highlighted);
  if (!nonHighlightedResults.length) return;

  const newestResults = getNewestResults(nonHighlightedResults, search?.newestOffer?.offerId, search?.newestOffer?.modified);
  
  if (newestResults.length) {
    await updateSearchData(search.searchId, newestResults[0]);
    await sendResultsToTelegram(newestResults);
  }
}

function getNewestResults(results, newestOfferId, lastModified) {
  const lastModifiedTimestamp = getTimestamp(lastModified);
  if (results.findIndex(result => result?.id === newestOfferId) === -1) return [results[0]];

  const newestResults = results 
    .sort((a, b) => getTimestamp(b.last_refresh_time) - getTimestamp(a.last_refresh_time))
    .filter(item => getTimestamp(item.last_refresh_time) > lastModifiedTimestamp)
    .slice(0, MAX_NUMBER_OF_RESULTS);

  return newestResults;
}

function getTimestamp(value) {
  if (typeof value === 'number') return value;
  const timestamp = Date.parse(value ?? '');
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function finalizeLambda() {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true })
  };
}
