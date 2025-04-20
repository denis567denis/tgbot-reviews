import { Telegraf, Markup } from 'telegraf';
import * as dotenv from 'dotenv';
import { updateDailyStats } from './services/statisticForDay.service';
import { updateActiveUserOrCreateUser } from './services/analiticsUsers';
import { getComments, addReview } from './services/data.service';
import { AnalyticsUsersModel } from './models/AnaliticsUsersModel';

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

function extractUsernameFromLink(text: string): string | null {
  const match = text.match(/https:\/\/t\.me\/\w+_bot\/(@\w+)/);
  return match ? match[1] : null;
}

async function sendComments(ctx: any, comments: any[]) {
  for (const item of comments) {
    const formattedDate = formatDate(item.createdAt);
    const message = `📅 Дата: ${formattedDate}\n👤 Автор: ${item.nameTg}\n💬 Сообщение: ${item.message}`;
    await ctx.reply(message);
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

    const keybord2 = Markup.keyboard([
      Markup.button.webApp('✍️ Добавить отзыв',`${process.env.HOST}/reviews/`),
    ]).resize();

    if (comments.length === 0) {
      return ctx.reply('Нет комментариев по этому человеку. Можете добавить свой отзыв выбрав кнопку',keybord2);
    }

    await sendComments(ctx, comments);

    const keyboard = Markup.inlineKeyboard([
      Markup.button.callback('Еще 5', 'next_5'),
    ]);

    await ctx.reply('Хотите увидеть больше комментариев?', keyboard);
    await ctx.reply('✍️ Или можете добавить свой отзыв по продовцу', keybord2);
  } catch (err) {
    console.error('Error fetching comments:', err);
    ctx.reply('Произошла ошибка при получении комментариев.');
  }
}

bot.command('start', async (ctx) => {
  const userId = ctx.from.id;
  const startPayload = ctx.message.text.split(' ')[1];

  if (startPayload) {
    const salesmanName = `@${startPayload}`;
    await handleCommentsRequest(ctx, userId, salesmanName);
    await updateDailyStats(userId.toString());
    await updateActiveUserOrCreateUser(userId, ctx.from.first_name, ctx.from.last_name || '', ctx.from.username || '');
  } else {
    try {
      const welcomeMessage = '👋 Привет! Я бот по отзывам продавца.';
      await ctx.reply(welcomeMessage,  Markup.keyboard([
          Markup.button.webApp('✍️ Добавить отзыв',`${process.env.HOST}/reviews/`),
        ]).resize()
      );
    } catch (error: any) {
      if(error.response && error.response.error_code === 403) {
        await AnalyticsUsersModel.deleteOne({idTg: `${ctx.from.id}`});
      }
        console.error('Ошибка при отправке сообщения:', error);

    }
  }
});

bot.hears('О боте', async (ctx) => {
  const aboutMessage = `
🤖 *О боте:*
Этот бот помогает вам находить отзывы о продавцах на платформе.
Вы можете искать отзывы по <@имя> продавца или пересылать сообщения с упоминанием продавца.
  `;
  await ctx.reply(aboutMessage, { parse_mode: 'Markdown'  });
});

bot.hears('Добавить отзыв', async (ctx) => {
  const addReviewMessage = `
✍️ *Добавить отзыв:*
Чтобы добавить отзыв, пожалуйста, используйте команду /add_review <@имя продавца> <ваш отзыв>.
Пример: /add_review @example_user Отличный продавец, рекомендую!
  `;
  await ctx.reply(addReviewMessage);
});

bot.command('info', async (ctx) => {
  const aboutMessage = `
🤖 *О боте:*
Этот бот помогает вам находить отзывы о продавцах на платформе.
Вы можете искать отзывы по <@имя> продавца или пересылать сообщения с упоминанием продавца.
  `;
  await ctx.reply(aboutMessage, { parse_mode: 'Markdown'  });
});

bot.command('add_review', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 2) {
    return ctx.reply('Пожалуйста, укажите имя продавца и ваш отзыв.');
  }
  const salesmanName = args[0];
  const reviewText = args.slice(1).join(' ');
  const userId = ctx.from.id;

  try {
    if(userId) {
      await addReview(salesmanName, userId, reviewText, ctx.from.username || ctx.from.first_name);
      await updateDailyStats(userId.toString());
      await updateActiveUserOrCreateUser(userId, ctx.from.first_name, ctx.from.last_name || '', ctx.from.username || '');
      await ctx.reply('Ваш отзыв успешно добавлен!');
    }
  } catch (err) {
    console.error('Error adding review:', err);
    await ctx.reply('Произошла ошибка при добавлении отзыва.');
  }
});

bot.on('message', async (ctx) => {
  const message = ctx.message;
  const userId = ctx.from.id;

  if (userId) {
    await updateDailyStats(userId.toString());
    await updateActiveUserOrCreateUser(userId, ctx.from.first_name, ctx.from.last_name || '', ctx.from.username || '');
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
      for (const salesmanName of salesmanNames) {
        const comments = await getComments(salesmanName, 0, 5);

        if (comments.length === 0) {
          await ctx.reply(`Нет комментариев для продавца ${salesmanName}.`);
          continue;
        }
        await sendComments(ctx, comments);
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
      ctx.reply('Произошла ошибка при получении комментариев.');
    }
  } else if ('text' in message) {
    const text = message.text.trim();

    const usernameFromLink = extractUsernameFromLink(text);

    if (usernameFromLink) {
      await handleCommentsRequest(ctx, userId, usernameFromLink);
    } else {
      const salesmanName = text;

      if (!salesmanName) {
        return ctx.reply('Пожалуйста, введите корректное имя или ссылку.');
      }

      await handleCommentsRequest(ctx, userId, salesmanName);
    }
  } else {
    return ctx.reply('Это не текстовое сообщение и не пересланное сообщение.');
  }
});

bot.action('next_5', async (ctx) => {
  const userId = ctx.from.id;

  if (!userSkipState[userId]) {
    return ctx.reply('Пожалуйста, сначала введите имя.');
  }

  if (userId) {
    await updateDailyStats(userId.toString());
    await updateActiveUserOrCreateUser(userId, ctx.from.first_name, ctx.from.last_name || '', ctx.from.username || '');
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

export default bot;