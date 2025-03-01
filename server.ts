import express from 'express';
import XLSX from 'xlsx';
import { DataModel } from './models/DataModel';
import { AnalyticsModel } from './models/AnalyticsModel';
import { dbConnection } from './db/dbConnection';
import path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = Number.parseInt(process.env.PORT!);

const excelFilePath1 = path.resolve(__dirname, './exelData/exel1.xlsx');
const excelFilePath2 = path.resolve(__dirname, './exelData/exel2.xlsx');
const excelFilePath3 = path.resolve(__dirname, './exelData/exel3.xlsx');

async function readExcelAndSaveToDB(excelFilePath: string, source: string): Promise<void> {
  try {
      const workbook = XLSX.readFile(excelFilePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      interface ExcelDataRow {
          data: string;
          name: string;
          id: string;
          message: string;
      }

      const rows: ExcelDataRow[] = XLSX.utils.sheet_to_json(sheet, { raw: false }) as ExcelDataRow[];

      const concurrencyLimit = 10;

      for (let i = 0; i < rows.length; i += concurrencyLimit) {
        console.log("row length: " + i);
          const batch = rows.slice(i, i + concurrencyLimit);

          await Promise.all(
              batch.map(async (row) => {
                  const salesman = parserNameOnText(row.message);
                  if (salesman) {
                    if(row.name && row.id && row.message && row.data) {
                      await analyzePosts(salesman);
                      await DataModel.insertOne({
                          nameTg: row.name,
                          idTg: row.id,
                          message: row.message,
                          salesman,
                          source,
                          createdAt: new Date(row.data),
                      });
                    }
                  }
              })
          );
          batch.length = 0;
      }

      console.log('All data inserted successfully.');
  } catch (err) {
      console.error('Error reading Excel or saving to DB:', err);
  }
}

async function analyzePosts(salesman: string[]) {
    const updates = salesman.map((salesElement) => ({
        updateOne: {
            filter: { authorName: salesElement },
            update: { $inc: { postCount: 1 } },
            upsert: true,
        },
    }));

    await AnalyticsModel.bulkWrite(updates);
}

function parserNameOnText(text: string) {
    const salesman = text.match(/@\w+/g);

    if (salesman) {
        return salesman;
    } else {
        return false;
    }
}

(async () => {
    try {
        await dbConnection.connect();

        app.listen(PORT, async () => {
            console.log(`Server running on port ${PORT}`);
            await readExcelAndSaveToDB(excelFilePath1, "@bookshaloba");
            await readExcelAndSaveToDB(excelFilePath2, "@raspakovkacpek");
            await readExcelAndSaveToDB(excelFilePath3, "@black_cashbacks2");
        });
    } catch (err) {
        console.error('Error starting server:', err);
        process.exit(1);
    }
})();

process.on('SIGINT', async () => {
    console.log('Received SIGINT. Disconnecting from MongoDB...');
    await dbConnection.disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM. Disconnecting from MongoDB...');
    await dbConnection.disconnect();
    process.exit(0);
});