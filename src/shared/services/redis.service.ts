import { createClient, RedisClientType } from 'redis';

export class RedisService {
  async getRedisClient(redisClient) {
    if (redisClient === undefined) {
      redisClient = createClient({
        username: process.env.REDIS_USERNAME,
        password: process.env.REDIS_PASSWORD,
        socket: {
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT, 10),
        },
        database: parseInt(process.env.REDIS_DB, 10),
      });
      console.log(
        'REDIS connection',
        process.env.REDIS_USERNAME,
        process.env.REDIS_PASSWORD,
        process.env.REDIS_HOST,
        process.env.REDIS_DB,
      );
      await redisClient.connect();
    }
    return <RedisClientType>redisClient;
  }
}
