
const logger = Loggers.createLogger(module.filename);

export default class Stats {

   constructor(redisNamespace, redisClient) {
      this.redisClient = Asserts.assert(redisClient, 'redisClient');
      this.redisNamespace = Asserts.assert(redisNamespace, 'redisNamespace');
   }

   async start() {
   }

   async end() {
      logger.info('end');
      this.redisClient.quit();
   }

   async count(name, ...args) {
      const hashesKey = this.redisKey(name);
      logger.debug('counter', name, args);
      this.redisClient.multiExecAsync(multi => {
         multi.hincrby(hashesKey, 'count', 1);
      });
   }

   async sum(name, value, ...args) {
      const hashesKey = this.redisKey(name);
      const max = await this.redisClient.hgetAsync(hashesKey, 'max');
      logger.debug('done', name, value, args);
      this.redisClient.multiExecAsync(multi => {
         multi.hincrby(hashesKey, 'count', 1);
         multi.hincrby(hashesKey, 'sum', value);
         if (!max || value > max) {
            multi.hset(hashesKey, 'max', value);
         }
      });
   }

   redisKey(...values) {
      return [this.redisNamespace, 'metrics', ...values].join(':');
   }
}
