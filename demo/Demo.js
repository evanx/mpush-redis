
export default class Demo {

   async loadConfig() {
      return require('./config');
   }

   async start(app) {
      this.app = app;
      this.redisClient = app.createRedisClient();
      this.logger = Loggers.createLogger(module.filename);
      setTimeout(() => {
         this.redisClient.lpush(app.config.in, 'one');
         this.redisClient.lpush(app.config.in, 'two');
         this.redisClient.lpush(app.config.in, 'three');
      }, 1000);
   }

   async end() {
      this.logger.info('end');
      this.ended = true;
      if (this.redisClient) {
         this.redisClient.quit();
      }
   }
}
