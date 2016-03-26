
const logger = Loggers.createLogger(module.filename);

export default class RenewInterval {

   constructor(name) {
      this.name = 'renew';
   }

   async start(state) {
      Object.assign(this, state);
      assert(this.props.serviceRedis, 'serviceRedis');
      this.redisClient = service.createRedisClient(this.props.serviceRedis);
      this.renewIntervalId = setInterval(() => this.run(), Invariants.props.serviceExpire.renew*1000);
      logger.info('started', this.service.key, Invariants.props.serviceExpire.renew);
   }

   async end() {
      if (this.ended) {
         logger.warn('end: ended');
         return;
      }
      this.ended = true;
      if (this.renewIntervalId) {
         clearInterval(this.renewIntervalId);
      }
      if (this.redisClient) {
         await this.redisClient.quitAsync();
      }
   }

   async run() {
      if (this.ended) {
         logger.warn('run: ended');
         return;
      }
      try {
         const [[time], exists, timestamp] = await this.redisClient.multiExecAsync(multi => {
            multi.time();
            multi.exists(this.service.key);
            multi.hget(this.service.key, 'renewed');
         });
         assert(time > 0, 'time');
         if (!exists) {
            throw new Error(`exists ${this.service.key} ${exists}`);
         }
         if (this.timestamp) {
            if (timestamp !== this.timestamp) {
               throw new Error(`renewed ${timestamp} ${this.timestamp}`);
            }
         }
         this.timestamp = time;
         const [expire, hset] = await this.redisClient.multiExecAsync(multi => {
            this.logger.debug('renew', this.service.key, this.timestamp, this.props.serviceExpire);
            multi.expire(this.service.key, this.props.serviceExpire);
            multi.hset(this.service.key, 'renewed', this.timestamp);
         });
         if (!expire) {
            throw new Error(`renew ${this.service.key}`);
         }
      } catch (err) {
         logger.error(err);
         this.service.end();
         throw err;
      }
   }
}
