// src/routes/auth.routes.ts
import express, {Request, Response} from 'express';
import path from 'path';
import { DataModel } from '../models/DataModel';
import { analyzePosts } from '../server';
const router = express.Router();

router.get('/',(req: Request, res: Response)=> {
    res.sendFile(path.join(__dirname, 'rewies.html'));
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

export default router;