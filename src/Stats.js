
export default class Stats {

   constructor() {
   }

   async start(app) {
      this.app = app;
      this.logger = app.createLogger(module.filename);
      this.redisClient = app.createRedisClient();
      this.ended = false;
   }

   async end() {
      this.logger.info('end');
      this.ended = true;
      if (this.redisClient) {
         this.redisClient.quit();
      }
   }

   async count(name, ...args) {
      const hashesKey = this.app.redisKey('metrics', name);
      this.logger.debug('counter', name, args);
      this.redisClient.multiExecAsync(multi => {
         multi.hincrby(hashesKey, 'count', 1);
      });
   }

   async peak(name, value, ...args) {
      const hashesKey = this.app.redisKey('metrics', name);
      const peak = await this.app.redisClient.hgetAsync(hashesKey, 'peak');
      this.logger.debug('peak', name, value, args);
      this.redisClient.multiExecAsync(multi => {
         multi.hincrby(hashesKey, 'count', 1);
         multi.hincrby(hashesKey, 'total', value);
         if (!peak || value > peak) {
            multi.hset(hashesKey, 'peak', value);
         }
      });
   }
}
