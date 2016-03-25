
export default class MonitorPending {

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
            await this.peekPending();
            await this.app.delay(1000);
         } catch (err) {
            this.logger.warn(err);
            await this.app.delay(9000);
         }
      }
   }

   async peekPending() {
      if (this.ended) {
         this.logger.warn('peekPending ended');
         return null;
      }
      const listKey = app.redisKey('ids');
      const [[timestamp], [id], length] = await this.redisClient.multiExecAsync(multi => {
         multi.time();
         multi.lrange(listKey, -1, -1);
         multi.llen(listKey);
      });
      this.logger.debug('peekPending', app.config.pending, timestamp, id, length);
      if (id) {
         if (length < this.app.config.messageCapacity*2/3) {
            const meta = await this.redisClient.hgetallAsync(app.redisKey('message', id));
            if (!meta) {
               this.app.stats.count('expired', id);
               await this.redisClient.lremAsync(listKey, -1, id);
               return this.peekPending();
            }
            let duration;
            if (meta.timestamp) {
               duration = timestamp - meta.timestamp;
               if (duration < this.app.config.messageTimeout) {
                  this.logger.debug('fresh', {id, timestamp});
                  return;
               }
               this.app.stats.done('timeout', duration, id);
            }
            const multiResults = await this.redisClient.multiExecAsync(multi => {
               multi.del(app.redisKey('message', id));
               multi.lrem(listKey, -1, id);
            });
            this.logger.info('removed', {id, meta, duration}, multiResults.join(' '));
         }
      }
   }
}
