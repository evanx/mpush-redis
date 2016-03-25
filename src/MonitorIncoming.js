
export default class MonitorIncoming {

   constructor(app) {
   }

   async start(app) {
      this.app = app;
      this.logger = Loggers.createLogger(module.filename);
      this.redisClient = app.createRedisClient();
      this.run();
   }

   async end() {
      this.logger.info('end');
      this.ended = true;
      if (this.redisClient) {
         this.redisClient.quit();
      }
   }

   async run() {
      this.logger.info('run');
      while (!this.ended) {
         try {
            await this.pop();
         } catch (err) {
            this.logger.warn(err);
            if (process.env.NODE_ENV === 'development') {
               this.ended = true;
            } else {
               await this.app.delay(2000);
            }
         }
      }
   }

   async pop() {
      if (this.ended) {
         this.logger.warn('ended');
         return null;
      }
      this.logger.debug('brpoplpush', this.app.config.in, this.app.config.pending, this.app.config.popTimeout);
      const message = await this.redisClient.brpoplpushAsync(this.app.config.in, this.app.config.pending, this.app.config.popTimeout);
      if (message) {
         const multi = this.redisClient.multi();
         this.app.config.out.forEach(out => multi.lpush(out, message));
         multi.lrem(this.app.config.pending, -1, message);
         await multi.execAsync();
         this.logger.debug('lpush', message, this.app.config.out);
      }
   }
}
