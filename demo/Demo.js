
export default class Demo {

   constructor(name) {
      this.name = name;
   }

   async start(that) {
      Object.assign(this, that);
      this.logger.info('started', this.props.redis);
      this.redisClient = this.service.createRedisClient(this.props.redis);
      setTimeout(() => {
         ['one', 'two', 'three'].forEach(message => {
            this.logger.info('push', this.props.in, message);
            this.redisClient.lpush(this.props.in, message);
         });
      }, 2000);
   }

   async end() {
      await this.redisClient.quitAsync();
   }
}
