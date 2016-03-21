
class Monitor {

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
            await this.peekPending();
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
            this.peak('done', duration, id);
         }
         const multiResults = await this.redisClient.multiExecAsync(multi => {
            multi.del(app.redisKey('messtime', id));
            multi.lrem(app.redisKey('ids'), -1, id);
         });
         this.logger.info('removed', {id, meta, duration}, multiResults.join(' '));
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
               this.counter('expired', id);
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
               this.peak('timeout', duration, id);
            }
            const multiResults = await this.redisClient.multiExecAsync(multi => {
               multi.del(app.redisKey('message', id));
               multi.lrem(listKey, -1, id);
            });
            this.logger.info('removed', {id, meta, duration}, multiResults.join(' '));
         }
      }
   }

   async count(name, ...args) {
      const hashesKey = this.app.redisKey('metrics', name);
      this.logger.debug('counter', name, args);
      this.redisClient.multiExecAsync(multi => {
         multi.hincrby(hashesKey, 'count', 1);
      });
   }

   async peak(name, value, ...args) {
      const hashesKey = this.app.redisKey('metrics', name);
      const peak = await this.app.redisClient.hgetAsync(hashesKey, 'peak');
      this.logger.debug('peak', name, value, args);
      this.redisClient.multiExecAsync(multi => {
         multi.hincrby(hashesKey, 'count', 1);
         multi.hincrby(hashesKey, 'total', value);
         if (!peak || value > peak) {
            multi.hset(hashesKey, 'peak', value);
         }
      });
   }

}

module.exports = Monitor;
