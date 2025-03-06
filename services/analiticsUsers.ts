import { AnalyticsUsersModel } from '../models/AnaliticsUsersModel';

export async function updateActiveUserOrCreateUser(idTg: number, firstName: string, lastName: string, username: string) {
  return await AnalyticsUsersModel.updateOne(
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
}