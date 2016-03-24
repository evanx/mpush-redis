
export default class MonitorIncoming {

   constructor() {
   }

   async start(app) {
      this.started = true;
      this.app = app;
      this.logger = app.createLogger(module.filename);
      this.redisClient = app.createRedisClient();
      this.ended = false;
      this.run();
   }

   async end() {
      if (this.started) {
         this.logger.info('end');
         this.ended = true;
         if (this.redisClient) {
            this.redisClient.quit();
         }
      }
   }

   async run() {
      this.logger.info('run');
      while (!this.ended) {
         try {
            await this.pop();
         } catch (err) {
            this.logger.warn(err);
            this.ended = true;
         }
      }
      this.end();
   }

   async pop() {
      if (this.ended) {
         this.logger.warn('ended');
         return null;
      }
      this.logger.info('brpoplpush', this.app.config.in, this.app.config.pending, this.app.config.popTimeout);
      const message = await this.redisClient.brpoplpushAsync(this.app.config.in, this.app.config.pending, this.app.config.popTimeout);
      if (message) {
         let id;
         if (/^[0-9]+$/.test(message)) {
            id = parseInt(message);
         } else {
            id = await this.redisClient.incrAsync(this.app.redisKey('id'));
         }
         const [[timestamp], length, existingTimestamp] = await this.redisClient.multiExecAsync(multi => {
            multi.time();
            multi.llen(this.app.redisKey('ids'));
            if (id) {
               multi.hget(this.app.redisKey('message', id), 'timestamp');
            }
         });
         if (existingTimestamp) {
            this.logger.warn('existingTimestamp', {id, existingTimestamp});
         } else {
            this.logger.info('read', {id, length, timestamp});
         }
         const multiResults = await this.redisClient.multiExecAsync(multi => {
            if (this.app.config.messageExpire > 0 && this.app.config.messageCapacity > 0 && length < this.app.config.messageCapacity) {
               multi.lpush(this.app.redisKey('ids'), id);
               multi.hmset(this.app.redisKey('message', id), {timestamp});
               multi.expire(this.app.redisKey('message', id), this.app.config.messageExpire);
            } else {
            }
            this.app.config.out.forEach(out => {
               this.logger.info('lpush', out, message);
               multi.lpush(out, message);
            });
            multi.lrem(this.app.config.pending, -1, message);
         });
         this.logger.debug('multiResults', multiResults);
      }
   }
}
