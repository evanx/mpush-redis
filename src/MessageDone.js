
export default class MessageDone {

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
      return this.runPromise;
   }

   async run() {
      this.logger.info('run');
      while (!this.ended && !this.service.ended) {
         try {
            await this.service.validate();
            await this.popDone();
         } catch (err) {
            this.service.error(this, err);
            break;
         }
      }
      this.ended = true;
      return this.redisClient.quitAsync();
   }

   async popDone() {
      const [id, llen, [timestampString]] = await this.redisClient.multiExecAsync(multi => {
         multi.brpop(this.props.done, this.props.popTimeout);
         multi.llen(this.props.done);
         multi.time();
      });
      const timestamp = Invariants.parseInt(timestampString);
      if (!id) {
         await this.service.delay(500);
      } else {
         this.logger.debug('rpop', this.props.done, timestamp, id, llen);
         const meta = await this.redisClient.hgetallAsync(this.redisKey(id));
         if (!meta) {
            this.components.metrics.count('done:expired', id);
            this.components.metrics.histo('done', 1, id);
            return this.popDone();
         }
         const interval = this.props.messageTimestamp;
         if (meta.deadline) {
            duration = timestamp - meta.timestamp;
            this.components.metrics.sum('done', duration, id);
            this.components.metrics.histo('done', Math.min(1, duration/interval), id);
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
