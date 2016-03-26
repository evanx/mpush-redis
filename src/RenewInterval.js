
const logger = Loggers.createLogger(module.filename);

export default class RenewInterval {

   constructor(name) {
      this.name = 'renew';
   }

   async start(state) {
      Object.assign(this, state);
      this.redisClient = service.createRedisClient(this.props.redis);
      this.renewIntervalId = setInterval(() => this.run(), Invariants.props.serviceExpire.renew*1000);
      this.logger.info('started', this.service.key, Invariants.props.serviceExpire.renew);
   }

   async end() {
      if (this.renewIntervalId) {
         clearInterval(this.renewIntervalId);
      }
      if (this.redisClient) {
         await this.redisClient.quitAsync();
      }
   }

   async run() {
      try {
         this.timestamp = (await this.redisClient.timeAsync())[0];
         const [expire, hset] = await this.redisClient.multiExecAsync(multi => {
            this.logger.debug('renew', this.service.key, this.timestamp, this.props.serviceExpire);
            multi.expire(this.service.key, this.props.serviceExpire);
            multi.hset(this.service.key, 'renewed', this.timestamp);
         });
         if (!expire) {
            this.logger.error('renew', this.service.key);
            this.service.end();
         }
      } catch (err) {
         this.logger.error('renew', err);
      }
   }
}
