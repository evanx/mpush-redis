
export default class MessagePending {

   constructor(name) {
      this.name = name;
   }

   async start(state) {
      Object.assign(this, state);
      this.redisNamespace = Asserts.assert(this.props.serviceNamespace, 'serviceNamespace');
      this.redisClient = service.createRedisClient(this.props.redis);
      this.runPromise = this.run();
   }

   async end() {
      return this.runPromise;
   }

   async run() {
      this.logger.info('run');
      while (!this.ended && !this.service.ended) {
         try {
            if (!this.service.ended) {
               await this.service.validate();
               await this.peekPending();
            }
         } catch (err) {
            this.service.error(this, err);
            break;
         }
      }
      this.ended = true;
      return this.redisClient.quitAsync();
   }

   async peekPending() {
      const listKey = this.redisKey('ids');
      const [[timestampString], [id], length] = await this.redisClient.multiExecAsync(multi => {
         multi.time();
         multi.lrange(listKey, -1, -1);
         multi.llen(listKey);
      });
      const timestamp = parseInt(timestampString);
      if (!id) {
         await this.service.delay(800);
      } else {
         this.logger.debug('peekPending', this.props.pending, timestamp, id, length);
         const meta = await this.redisClient.hgetallAsync(this.redisKey(id));
         if (!meta) {
            this.components.metrics.count('message:expire', id);
            await this.redisClient.lremAsync(listKey, -1, id);
            return;
         }
         assert(meta.deadline, 'deadline');
         const deadline = Invariants.parseTimestamp(meta.deadline, 'deadline');
         if (deadline && timestamp > deadline) {
            const timeout = timestamp - deadline;
            this.components.metrics.sum('timeout', timeout, id);
            const multiResults = await this.redisClient.multiExecAsync(multi => {
               multi.del(this.redisKey(id));
               multi.lrem(listKey, -1, id);
            });
            this.logger.info('removed', {id, meta, deadline, timeout}, multiResults.join(' '));
            return;
         }
         this.logger.info('pending', {id, meta});
      }
   }

   redisKey(...values) {
      return [this.redisNamespace, 'message', ...values].join(':');
   }
}
