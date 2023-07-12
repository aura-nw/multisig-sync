/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-var-requires */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
const Queue = require('bull');
const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');

async function bootstrap() {
    let app;
    try {
        app = await NestFactory.create(AppModule);
    } catch (error) {
        console.log('Error in main.ts', error);
    }

    // setup swagger
    const config = new DocumentBuilder()
        .setTitle('Multisig Wallet API for Aura Network')
        .setVersion('0.1')
        .addServer('/')
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('documentation', app, document);

    // setup bull board
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    const queue = new BullAdapter(
        Queue(
            'sync-rest',
            `redis://${process.env.REDIS_USERNAME}:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}/${process.env.REDIS_DB}`,
            {
                prefix: `pyxis-safe-sync-${
                    JSON.parse(process.env.CHAIN_SUBCRIBE)[0]
                }`,
            },
        ),
    );
    createBullBoard({
        queues: [queue],
        serverAdapter,
    });
    app.use('/admin/queues', serverAdapter.getRouter());

    await app.listen();
}
bootstrap();
