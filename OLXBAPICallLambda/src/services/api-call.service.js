import { SEARCH_URL, HEADERS } from '../config/url-config.js';
import { ERROR_SEARCHES_ARRAY, createErrorSearchEntry } from './api-call-error-handler.service.js';

const SEARCH_QUERY = `query ListingSearchQuery(
  $searchParameters: [SearchParameter!] = []
  $fetchJobSummary: Boolean = false
  $fetchPayAndShip: Boolean = false
) {
  clientCompatibleListings(searchParameters: $searchParameters) {
    __typename
    ... on ListingSuccess {
      data {
        id
        title
        url
        created_time
        last_refresh_time
        description
      }
    }
  }
}`;

export async function firstCall(search) {
  const body = buildRequestBody(search);
  try {
    const res = await fetchSearchResults(body, search.alias);
    const items = res?.data?.clientCompatibleListings?.data;
    return Array.isArray(items) ? items : [];
  } catch(e) {
    console.log('First call failed', e);
    const errorEntry = createErrorSearchEntry(search.alias, 'first call');
    ERROR_SEARCHES_ARRAY.push(errorEntry);
    return [];
  }
}

async function fetchSearchResults(body, searchAlias) {
  const rawResults = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(body)
  });
  if (rawResults.ok) {
    const jsonResults = await rawResults.json();

    return jsonResults;
  } else {
    const errorText = `Fetch call for search ${searchAlias} failed with STATUS: ${rawResults.status}`;
    console.log(errorText);
    const errorEntry = createErrorSearchEntry(searchAlias, 'fetch', rawResults.status);
    ERROR_SEARCHES_ARRAY.push(errorEntry);
    throw new Error(errorText);
  }
}

function buildRequestBody(search) {
  const searchParameters = [
    { key: 'offset', value: '0' },
    { key: 'limit', value: '40' },
    { key: 'query', value: search.searchTerm },
    { key: 'sort_by', value: 'created_at:desc' }
  ];

  search.minPrice && searchParameters.push({ key: 'filter_float_price:from', value: search.minPrice });
  search.maxPrice && searchParameters.push({ key: 'filter_float_price:to', value: search.maxPrice });

  const conditionsArray = Array.from(search.condition ?? ['']);

  if (conditionsArray[0] !== '') {
    conditionsArray.forEach((condition, idx) => {
      searchParameters.push({ key: `filter_enum_state[${idx}]`, value: condition });
    });
  }

  return {
    query: SEARCH_QUERY,
    variables: {
      searchParameters,
      fetchJobSummary: false,
      fetchPayAndShip: false
    }
  };
}
