import express, {Request, Response} from 'express';
import { dbConnection } from './db/dbConnection';
import * as dotenv from 'dotenv';
import bot from './bot';
import routerApp from './routers/app.router';

dotenv.config();

const app = express();
const PORT = Number.parseInt(process.env.PORT!);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/reviews', routerApp);
(async () => {
    try {
        await dbConnection.connect();

        app.listen(PORT, async () => {
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
            console.log(`Server running on port ${PORT}`);
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