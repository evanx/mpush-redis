
export default class Stats {

   constructor() {
   }

   async start(app) {
      this.started = true;
      this.app = app;
      this.logger = app.createLogger(module.filename);
      this.redisClient = app.createRedisClient();
      this.ended = false;
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

   async count(name, ...args) {
      const hashesKey = this.app.redisKey('metrics', name);
      this.logger.debug('counter', name, args);
      this.redisClient.multiExecAsync(multi => {
         multi.hincrby(hashesKey, 'count', 1);
      });
   }

   async done(name, value, ...args) {
      const hashesKey = this.app.redisKey('metrics', name);
      const max = await this.app.redisClient.hgetAsync(hashesKey, 'max');
      this.logger.debug('done', name, value, args);
      this.redisClient.multiExecAsync(multi => {
         multi.hincrby(hashesKey, 'count', 1);
         multi.hincrby(hashesKey, 'sum', value);
         if (!max || value > max) {
            multi.hset(hashesKey, 'max', value);
         }
      });
   }
}
