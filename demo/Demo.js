
export default class Demo {

   async loadConfig() {
      return require('./config');
   }

   async start(app) {
      this.started = true;
      this.app = app;
      this.redisClient = app.createRedisClient();
      this.logger = app.createLogger(module.filename);
      setTimeout(() => {
         this.redisClient.lpush(app.config.in, 'one');
         this.redisClient.lpush(app.config.in, 'two');
         this.redisClient.lpush(app.config.in, 'three');
      }, 1000);
      setTimeout(() => {
         this.redisClient.lpush(app.config.done, 'three');
      }, 2000);
   }

   async end() {
      if (this.started) {
         this.logger.info('end');
         this.ended = true;
         if (this.redisClient) {
            this.redisClient.quit();
         }
      }
   }
}
