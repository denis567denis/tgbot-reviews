import { StatisticsForDayModel } from '../models/StatisticActionForDayModel';
import { AnalyticsUsersModel } from '../models/AnaliticsUsersModel';

function formatDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  };
  return new Intl.DateTimeFormat('ru-RU', options).format(date);
}

export async function updateDailyStats(userId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const formattedToday = formatDate(today);
  const formattedTomorrow = formatDate(tomorrow);

  const dateRange = `${formattedToday} - ${formattedTomorrow}`;

  const userExists = await AnalyticsUsersModel.exists({ idTg: userId });

  const type = userExists ? 'request' : 'connection';

  const update = {
    $inc: { [type === 'connection' ? 'connections' : 'totalRequests']: 1 },
    $addToSet: { uniqueUsers: userId },
  };

  await StatisticsForDayModel.updateOne(
    { date: dateRange },
    update,
    { upsert: true }
  );
}