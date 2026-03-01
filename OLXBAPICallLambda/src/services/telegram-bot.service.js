import TelegramBot from 'node-telegram-bot-api';
import { getPriceInEurFromParams } from '../utils/price.util.js';

const BOT = new TelegramBot(process.env.TOKEN);
const CHAT_ID = process.env.CHAT_ID;

export async function sendResultsToTelegram(newestResults) {
  for (const result of newestResults) {
    await botResponseHTML(buildTelegramResponse(result));
    await asyncTimeout();
  }
}

export async function botResponse(text) {
  await BOT.sendMessage(CHAT_ID, text);
}

export async function botResponseHTML(text) {
  await BOT.sendMessage(CHAT_ID, text, { parse_mode: 'HTML' });
}

async function asyncTimeout() {
  return new Promise(resolve => setTimeout(resolve, 1000));
}

function buildTelegramResponse(item) {
  const itemUrl = item.url;
  const location = [item.location?.city?.name, item.location?.district?.name, item.location?.region?.name].filter(Boolean).join(', ');
  const eurPrice = getPriceInEurFromParams(item.params);

  return `<a href='${item.photos?.[0]?.link ?? ''}'> </a> \n<b>TITLE:</b> ${item.title} \n<b>PRICE:</b> ${eurPrice} \n<b>DESC:</b> ${item.description} \n<b>LOCATION:</b> ${location} \n<b>LINK:</b> <a href='${itemUrl}'>CLICK</a>`;
}
