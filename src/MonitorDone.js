
export default class MonitorDone {

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
            await this.popDone();
            await this.service.delay(1000);
         } catch (err) {
            this.logger.error(err);
            this.ended = true;
            this.service.end();
         }
      }
      return this.redisClient.quitAsync();
   }

   async popDone() {
      const [[timestamp], id, length] = await this.redisClient.multiExecAsync(multi => {
         multi.time();
         multi.rpop(this.props.done);
         multi.llen(this.props.done);
      });
      this.logger.debug('rpop', this.props.done, timestamp, id, length);
      if (id) {
         const meta = await this.redisClient.hgetallAsync(this.redisKey(id));
         if (!meta) {
            return this.popDone();
         }
         let duration;
         if (meta.timestamp) {
            duration = timestamp - meta.timestamp;
            this.service.metrics.sum('done', duration, id);
         }
         const multiResults = await this.redisClient.multiExecAsync(multi => {
            multi.del(this.redisKey(id));
            multi.lrem(this.redisKey('ids'), -1, id);
         });
         this.logger.info('removed', {id, meta, duration}, multiResults.join(' '));
      }
   }

   redisKey(...values) {
      return [this.redisNamespace, 'message', ...values].join(':');
   }
}
