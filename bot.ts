import { Telegraf, Markup } from 'telegraf';
import { dbConnection } from './db/dbConnection';
import * as dotenv from 'dotenv';
import { DataModel } from './models/DataModel';
import { AnalyticsUsersModel } from "./models/AnaliticsUsersModel";

dotenv.config();

const bot = new Telegraf(process.env.API_BOT!);

const userSkipState: { [userId: number]: { skip: number; salesmanName: string } } = {};

function formatDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  };
  return new Intl.DateTimeFormat('ru-RU', options).format(date);
}

function findSalesmanName(text: string) {
  const salesman = text.match(/@\w+/g);
  return salesman ? salesman : false;
}

function isForwardedMessage(message: any): message is { forward_date: number } {
  return 'forward_date' in message;
}

function getMessageText(message: any): string | undefined {
  if ('text' in message) {
    return message.text;
  } else if ('caption' in message) {
    return message.caption;
  }
  return undefined;
}

async function sendComments(ctx: any, comments: any[]) {
  for (const item of comments) {
    const formattedDate = formatDate(item.createdAt);
    const message = `📅 Дата: ${formattedDate}\n👤 Автор: ${item.nameTg}\n💬 Сообщение: ${item.message}`;
    await ctx.reply(message);
  }
}

async function getComments(salesmanName: string, skip: number, limit: number) {
  return await DataModel.aggregate([
    {
      $match: { salesman: salesmanName },
    },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
  ]);
}

async function updateActiveUserOrCreateUser(ctx: any) {
  const idTg = ctx.from.id;
  const firstName = ctx.from.first_name;
  const lastName = ctx.from.last_name || '';
  const username = ctx.from.username || '';
  try {
    await AnalyticsUsersModel.updateOne(
      { idTg },
      {
        $set: {
          firstName,
          lastName,
          username,
          idTg,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
    console.log(`User ${idTg} updated in the database.`);
  } catch (err) {
    console.error('Error updating user data:', err);
  }
}

async function handleCommentsRequest(ctx: any, userId: number, salesmanName: string) {
  try {
    if (userSkipState[userId] && userSkipState[userId].salesmanName !== salesmanName) {
      delete userSkipState[userId];
    }

    if (!userSkipState[userId]) {
      userSkipState[userId] = { skip: 0, salesmanName };
    }

    const comments = await getComments(salesmanName, userSkipState[userId].skip, 5);

    if (comments.length === 0) {
      return ctx.reply('Нет комментариев по этому человеку.');
    }

    await sendComments(ctx, comments);

    const keyboard = Markup.inlineKeyboard([
      Markup.button.callback('Еще 5', 'next_5'),
    ]);

    await ctx.reply('Хотите увидеть больше комментариев?', keyboard);
  } catch (err) {
    console.error('Error fetching comments:', err);
    ctx.reply('Произошла ошибка при получении комментариев.');
  }
}

(async () => {
  try {
    await dbConnection.connect();
    bot.launch();
    console.log('Bot is running...');
  } catch (err) {
    console.error('Error starting bot:', err);
    process.exit(1);
  }
})();

bot.command('start', (ctx) => {
  const welcomeMessage = `
👋 Привет! Я бот по отзывам продавца.
Чтобы начать, введи <@имя> или поделись постом с ботом, в котором есть имя продавца.
  `;
  ctx.reply(welcomeMessage);
});

bot.on('message', async (ctx) => {
  const message = ctx.message;
  const userId = ctx.from.id;

  if (userId) {
    await updateActiveUserOrCreateUser(ctx);
  }

  if (isForwardedMessage(message)) {
    const postText = getMessageText(message);

    if (!postText) {
      return ctx.reply('Пересланное сообщение не содержит текста или подписи.');
    }

    const salesmanNames = findSalesmanName(postText);

    if (!salesmanNames) {
      return ctx.reply('Имя продавца не найдено в пересланном сообщении.');
    }

    try {
      await handleCommentsRequest(ctx, userId, salesmanNames[0]);
    } catch (err) {
      console.error('Error fetching comments:', err);
      ctx.reply('Произошла ошибка при получении комментариев.');
    }
  }
  else if ('text' in message) {
    const salesmanName = message.text.trim();

    if (!salesmanName) {
      return ctx.reply('Пожалуйста, введите корректное имя.');
    }

    await handleCommentsRequest(ctx, userId, salesmanName);
  }
  else {
    return ctx.reply('Это не текстовое сообщение и не пересланное сообщение.');
  }
});

bot.action('next_5', async (ctx) => {
  const userId = ctx.from.id;

  if (!userSkipState[userId]) {
    return ctx.reply('Пожалуйста, сначала введите имя.');
  }

  if (userId) {
    await updateActiveUserOrCreateUser(ctx);
  }

  userSkipState[userId].skip += 5;
  await handleCommentsRequest(ctx, userId, userSkipState[userId].salesmanName);
});

process.on('SIGINT', () => {
  bot.stop('SIGINT');
  console.log('Bot stopped.');
});

process.on('SIGTERM', () => {
  bot.stop('SIGTERM');
  console.log('Bot stopped.');
});