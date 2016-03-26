
export default class MonitorIncoming {

   constructor(name) {
      this.name = name;
   }

   async start(state) {
      Object.assign(this, state);
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
            await this.pop();
         } catch (err) {
            this.logger.warn(err);
            this.ended = true;
            this.service.end();
         }
      }
      await this.redisClient.quitAsync();
   }

   async pop() {
      await this.service.validate();
      if (this.ended) {
         this.logger.warn('ended');
         return;
      }
      this.logger.debug('brpoplpush', this.props.in, this.props.pending, this.props.popTimeout);
      const message = await this.redisClient.brpoplpushAsync(this.props.in, this.props.pending, this.props.popTimeout);
      if (message) {
         this.logger.debug('lpush', message, this.props.out);
         const multi = this.redisClient.multi();
         this.props.out.forEach(out => multi.lpush(out, message));
         multi.lrem(this.props.pending, -1, message);
         await multi.execAsync();
      }
   }
}
