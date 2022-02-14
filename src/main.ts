import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // setup swagger
    const config = new DocumentBuilder()
        .setTitle('Multisig Wallet API for Aura Network')
        .setVersion('0.1')
        .addServer('/')
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('documentation', app, document);

    await app.listen(3000);
}
bootstrap();
