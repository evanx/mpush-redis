
export default class Demo {

   constructor(props, service) {
      Object.assign(this, {props, service}, {
         redisClient: service.createRedisClient(props.redis),
         logger: service.createLogger(module.filename)
      });
   }

   async start() {
      setTimeout(() => {
         this.redisClient.lpush(this.props.in, 'one');
         this.redisClient.lpush(this.props.in, 'two');
         this.redisClient.lpush(this.props.in, 'three');
      }, 1000);
   }

   async end() {
      this.logger.info('end');
      this.ended = true;
      if (this.redisClient) {
         this.redisClient.quit();
      }
   }
}
