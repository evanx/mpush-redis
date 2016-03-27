
export default class MonitorPending {

   constructor(name) {
      this.name = name;
   }

   async start(state) {
      Object.assign(this, state);
      this.redisNamespace = Asserts.assert(this.props.serviceNamespace, 'redisNamespace');
      this.redisClient = service.createRedisClient(this.props.redis);
      this.runPromise = this.run();
   }

   async end() {
      this.ended = true;
      return this.runPromise;
   }

   async run() {
      this.logger.info('run');
      while (!this.ended) {
         try {
            await this.service.validate();
            await this.peekPending();
            await this.service.delay(1000);
         } catch (err) {
            this.logger.error(err);
            this.ended = true;
            this.service.end();
         }
      }
      return this.redisClient.quitAsync();
   }

   async peekPending() {
      const listKey = this.redisKey('ids');
      const [[timestamp], [id], length] = await this.redisClient.multiExecAsync(multi => {
         multi.time();
         multi.lrange(listKey, -1, -1);
         multi.llen(listKey);
      });
      this.logger.debug('peekPending', this.props.pending, timestamp, id, length);
      if (id) {
         if (length < this.props.messageCapacity*2/3) {
            const meta = await this.redisClient.hgetallAsync(this.redisKey(id));
            if (!meta) {
               this.metrics.count('expired', id);
               await this.redisClient.lremAsync(listKey, -1, id);
               return this.peekPending();
            }
            let duration;
            if (meta.timestamp) {
               duration = timestamp - meta.timestamp;
               if (duration < this.props.messageTimeout) {
                  this.logger.debug('fresh', {id, timestamp});
                  return;
               }
               this.metrics.sum('timeout', duration, id);
            }
            const multiResults = await this.redisClient.multiExecAsync(multi => {
               multi.del(this.redisKey(id));
               multi.lrem(listKey, -1, id);
            });
            this.logger.info('removed', {id, meta, duration}, multiResults.join(' '));
         }
      }
   }

   redisKey(...values) {
      return [this.redisNamespace, 'message', ...values].join(':');
   }
}
