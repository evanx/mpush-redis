
export default class MessageRegister {

   constructor(name) {
      this.name = name;
   }

   async start(state) {
      Object.assign(this, state);
      this.redisClient = service.createRedisClient(this.props.serviceRedis);
      this.redisNamespace = Asserts.assert(this.props.serviceNamespace, 'redisNamespace');
   }

   async end() {
      return this.redisClient.quitAsync();
   }

   async registerMessage(message) {
      logger.debug('registerMessage', this.redisKey('id'));
      const id = await this.redisClient.incrAsync(this.redisKey('id'));
      logger.debug('registerMessage', id);
      let otherId;
      if (/^[0-9]+$/.test(message)) {
         otherId = message;
      } else if (message.meta && message.meta.id) {
         otherId = message.meta.id;
      } else {
         otherId = this.service.sha1(message);
      }
      logger.debug('registerMessage', id, otherId);
      const [[timestamp], length, exists] = await this.redisClient.multiExecAsync(multi => {
         multi.time();
         multi.llen(this.redisKey('ids'));
         multi.exists(this.redisKey(id));
      });
      if (exists) {
         throw new Error('message exists: ' + this.redisKey(id));
      }
      if (length > this.props.messageCapacity) {
         this.components.metrics.max('messageCapacity', length, this.props.messageCapacity);
      } else {
         assert(this.props.messageExpire > 0, 'messageExpire');
         const multiResults = await this.redisClient.multiExecAsync(multi => {
            logger.debug('register', id, otherId, timestamp);
            multi.lpush(this.redisKey('ids'), id);
            multi.hmset(this.redisKey('message', id), {timestamp, otherId});
            multi.expire(this.redisKey('message', id), this.props.messageExpire);
         });
      }
   }

   redisKey(...values) {
      return [this.redisNamespace, 'message', ...values].join(':');
   }
}
