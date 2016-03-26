
export default class Demo {

   constructor(name) {
      this.name = name;
   }

   async start(that) {
      Object.assign(this, that);
      this.logger.info('started', this.props.redis);
      this.redisClient = this.service.createRedisClient(this.props.redis);
      setTimeout(() => {
         this.redisClient.lpush(this.props.in, 'one');
         this.redisClient.lpush(this.props.in, 'two');
         this.redisClient.lpush(this.props.in, 'three');
      }, 2000);
   }

   async end() {
      await this.redisClient.quitAsync();
   }
}
