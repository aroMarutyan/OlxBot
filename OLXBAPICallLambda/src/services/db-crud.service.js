import { DynamoDBClient, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall, marshall } from '@aws-sdk/util-dynamodb';
import { getPriceInEurFromParams } from '../utils/price.util.js';

const DDB = new DynamoDBClient({region: 'eu-west-1'});
const TABLE_NAME = process.env.TABLE_NAME;

export async function getSearches() {
  try {
    const data = await DDB.send(new ScanCommand({ TableName: TABLE_NAME, ConsistentRead: true }));
    const remappedData = data.Items.map(search => unmarshall(search));

    return remappedData;
  } catch(e) {
    console.log('Could not get searches', e);
    throw e;
  }
}

export async function updateSearchData(searchId, newestResult) {
  await updateSearchStringKey(searchId, 'newestOffer', remapOffer(newestResult));
}

async function updateSearchStringKey(searchId, key, value) {
  try {
    const searchToEdit = {
      TableName: TABLE_NAME,
      Key: marshall({ searchId: searchId }),
      ExpressionAttributeNames: { '#KEY': `${key}` },
      ExpressionAttributeValues: marshall({ ':VAL': value }),
      ReturnValues: 'ALL_NEW',
      UpdateExpression: 'SET #KEY = :VAL'
    };

    await DDB.send(new UpdateItemCommand(searchToEdit));
  } catch(e) {
    console.log('Error updating search', e);
    throw e;
  }
}

function remapOffer(item) {
  return {
    imageUrl: item.photos?.[0]?.link,
    title: item.title,
    price: getPriceInEurFromParams(item.params),
    description: item.description,
    location: {
      city: item.location?.city?.name,
      district: item.location?.district?.name,
      region: item.location?.region?.name
    },
    link: item.url,
    offerId: item.id,
    modified: item.last_refresh_time
  }
}
