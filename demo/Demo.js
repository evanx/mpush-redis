
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
            let results = await this.redisClient.multiExecAsync(multi => {
               multi.lrange(this.props.out[0], -1 -1);
            });
            logger.info('results', results);
            this.service.end();
         }, 1000);
      }, 2000);
   }

   async end() {
      await this.redisClient.quitAsync();
   }
}
