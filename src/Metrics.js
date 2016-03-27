
export default class Metrics {

   constructor(name) {
      this.name = name;
   }

   async start(state) {
      Object.assign(this, state);
      this.redisNamespace = Asserts.assert(this.props.serviceNamespace, 'redisNamespace');
      this.redisClient = service.createRedisClient(Asserts.assert(this.props.serviceRedis, 'serviceRedis'));
      this.logger.info('start');
   }

   async end() {
      this.ended = true;
      await this.redisClient.quitAsync();
   }

   async count(name, ...args) {
      try {
         const hashesKey = this.redisKey(name);
         this.logger.debug('counter', name, args);
         this.redisClient.multiExecAsync(multi => {
            multi.hincrby(hashesKey, 'count', 1);
         });
      } catch (err) {
         logger.warn('count', name, err);
      }
   }

   async sum(name, value, ...args) {
      try {
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
      } catch (err) {
         logger.warn('sum', name, err);
      }
   }

   redisKey(...values) {
      return [this.redisNamespace, this.name, ...values].join(':');
   }
}
