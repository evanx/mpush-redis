
class MonitorDone {

   constructor() {
   }

   async start(app) {
      this.app = app;
      this.logger = app.createLogger(module.filename);
      this.redisClient = app.createRedisClient();
      this.ended = false;
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
            await this.popDone();
            await this.app.delay(1000);
         } catch (err) {
            this.logger.warn(err);
            await this.app.delay(9000);
         }
      }
   }

   async popDone() {
      if (this.ended) {
         this.logger.warn('popDone ended');
         return null;
      }
      const [[timestamp], id, length] = await this.redisClient.multiExecAsync(multi => {
         multi.time();
         multi.rpop(app.config.done);
         multi.llen(app.config.done);
      });
      this.logger.debug('rpop', app.config.done, timestamp, id, length);
      if (id) {
         const meta = await this.redisClient.hgetallAsync(app.redisKey('message', id));
         if (!meta) {
            return this.popDone();
         }
         let duration;
         if (meta.timestamp) {
            duration = timestamp - meta.timestamp;
            this.app.stats.peak('done', duration, id);
         }
         const multiResults = await this.redisClient.multiExecAsync(multi => {
            multi.del(app.redisKey('messtime', id));
            multi.lrem(app.redisKey('ids'), -1, id);
         });
         this.logger.info('removed', {id, meta, duration}, multiResults.join(' '));
      }
   }
}

module.exports = MonitorDone;
