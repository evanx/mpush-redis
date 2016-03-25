
import fs from 'fs';

export default class Config  { // support Redis-based config

   constructor() {
   }

   async start(app) {
      this.service = app;
      this.logger = Loggers.createLogger(module.filename);
      this.redisClient = app.createRedisClient();
   }

   async end() {
      this.logger.info('end');
      this.ended = true;
      if (this.redisClient) {
         this.redisClient.quit();
      }
   }

   async setConfig(key, config) {
      await this.redisClient.hsetall(key, config);
   }
}
