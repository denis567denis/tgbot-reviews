import { DataModel } from '../models/DataModel';

export async function getComments(salesmanName: string, skip: number, limit: number) {
  return await DataModel.aggregate([
    { $match: { salesman: salesmanName } },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
  ]);
}

export async function addReview(salesmanName: string, idTg: number, message: string, nameTg: string) {
  return await DataModel.create({
    salesman: salesmanName,
    idTg,
    message,
    source: "black list bot",
    nameTg,
    createdAt: new Date(),
  });
}