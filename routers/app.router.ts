import express, {Request, Response} from 'express';
import path from 'path';
import multer from 'multer';
import { DataModel } from '../models/DataModel';
import { AnalyticsModel } from '../models/AnalyticsModel';
import XLSX from 'xlsx';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.get('/',(req: Request, res: Response)=> {
    res.sendFile(path.join(__dirname, '../root/rewies.html'));
});

router.post('/sendRewie',async (req: Request, res: Response) => {
    const {userId, userName, salesmanName, reviewText } = req.body;

    if(userId && salesmanName && reviewText) {
    await analyzePosts([salesmanName]);
    await DataModel.insertOne({
        nameTg: userName,
        idTg: userId,
        message: reviewText,
        salesman: [salesmanName],
        source: "Черный список бот",
        createdAt: new Date(),
    });
    }
})

router.post('/upload-excel', upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Файл не был загружен.' });
        return;
      }
  
      const excelFilePath = req.file.path;
      const source = req.body.source || 'unknown';
  
      const workbook = XLSX.readFile(excelFilePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
  
      interface ExcelDataRow {
        channel_name?: string;
        date?: string;
        username?: string;
        userid?: string;
        message?: string;
      }
  
      const rows: ExcelDataRow[] = XLSX.utils.sheet_to_json(sheet, { raw: false }) as ExcelDataRow[];
  
      const concurrencyLimit = 10;
  
      for (let i = 0; i < rows.length; i += concurrencyLimit) {
        console.log("Processing rows: " + i);
        const batch = rows.slice(i, i + concurrencyLimit);
  
        await Promise.all(
          batch.map(async (row) => {
            if(row.message) {
                const salesman = parserNameOnText(row.message);
                if (salesman) {
                  if (row.username && row.userid && row.message && row.date && row.channel_name) {
                    await analyzePosts(salesman);
                    await DataModel.insertOne({
                      nameTg: row.username,
                      idTg: row.userid,
                      message: row.message,
                      salesman,
                      source: row.channel_name,
                      createdAt: new Date(row.date),
                    });
                  }
                }
            }
          })
        );
  
        batch.length = 0;
      }
  
      console.log('Все данные успешно обработаны.');
      res.status(200).json({ message: 'Файл успешно обработан.' });
    } catch (err) {
      console.error('Ошибка при чтении Excel или сохранении в базу данных:', err);
      res.status(500).json({ error: 'Ошибка при обработке файла.' });
    }
  });

export async function analyzePosts(salesman: string[]) {
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


export default router;