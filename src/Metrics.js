
export default class Metrics {

   constructor(name) {
      this.name = name;
   }

   async start(state) {
      Object.assign(this, state);
      this.redisNamespace = Asserts.assert(this.props.redisNamespace, 'redisNamespace');
      this.redisClient = service.createRedisClient(this.props.redis);
      this.logger.info('start');
   }

   async end() {
      this.ended = true;
      await this.redisClient.quitAsync();
   }

   async count(name, ...args) {
      if (this.ended) {
         this.logger.error('count ended', name);
         return;
      }
      const hashesKey = this.redisKey(name);
      this.logger.debug('counter', name, args);
      this.redisClient.multiExecAsync(multi => {
         multi.hincrby(hashesKey, 'count', 1);
      });
   }

   async sum(name, value, ...args) {
      if (this.ended) {
         this.logger.error('sum ended', name);
         return;
      }
      const hashesKey = this.redisKey(name);
      const max = await this.redisClient.hgetAsync(hashesKey, 'max');
      this.logger.debug('done', name, value, args);
      this.redisClient.multiExecAsync(multi => {
         multi.hincrby(hashesKey, 'count', 1);
         multi.hincrby(hashesKey, 'sum', value);
         if (!max || value > max) {
            multi.hset(hashesKey, 'max', value);
         }
      });
   }

   redisKey(...values) {
      return [this.redisNamespace, this.name, ...values].join(':');
   }
}
