
export default class Demo {

   constructor(name) {
      this.name = name;
   }

   async start(that) {
      Object.assign(this, that);
      this.logger.info('started', this.props.redis);
      this.redisClient = this.service.createRedisClient(this.props.redis);
      const messages = ['one', 'two', 'three'];
      setTimeout(() => {
         messages.forEach(message => {
            this.logger.info('push', this.props.in, message);
            this.redisClient.lpush(this.props.in, message);
         });
         setTimeout(async () => {
            let [[id]] = await this.redisClient.multiExecAsync(multi => {
               logger.info('lrange', this.props.out[0]);
               multi.lrange(this.props.out[0], 0, 0);
            });
            logger.info('results', id);
            assert.equal(id, lodash.last(messages), 'last id');
            this.service.end();
         }, 3000);
      }, 2000);
   }

   async end() {
      await this.redisClient.quitAsync();
   }
}
