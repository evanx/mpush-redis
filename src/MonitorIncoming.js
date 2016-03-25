
export default class MonitorIncoming {

   constructor(props, service) {
      this.props = props;
      this.service = this.service;
      this.logger = service.createLogger(module.filename);
      this.redisClient = service.createRedisClient(props.redis);
   }

   async start() {
      this.run();
   }

   async end() {
      this.logger.info('end');
      this.ended = true;
      if (this.redisClient) {
         this.redisClient.quit();
      }
   }

   async run() {
      this.logger.info('run');
      while (!this.ended) {
         try {
            await this.pop();
         } catch (err) {
            this.logger.warn(err);
            if (process.env.NODE_ENV === 'development') {
               this.ended = true;
            } else {
               await this.service.delay(2000);
            }
         }
      }
   }

   async pop() {
      if (this.ended) {
         this.logger.warn('ended');
         return null;
      }
      this.logger.debug('brpoplpush', this.props.in, this.props.pending, this.props.popTimeout);
      const message = await this.redisClient.brpoplpushAsync(this.props.in, this.props.pending, this.props.popTimeout);
      if (message) {
         const multi = this.redisClient.multi();
         this.props.out.forEach(out => multi.lpush(out, message));
         multi.lrem(this.props.pending, -1, message);
         await multi.execAsync();
         this.logger.debug('lpush', message, this.props.out);
      }
   }
}
