
import fs from 'fs';

export default class Config  { // support Redis-based config

   constructor() {
   }

   async start(app) {
      this.app = app;
      this.logger = app.createLogger(module.filename);
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
