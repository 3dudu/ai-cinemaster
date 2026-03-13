/**
 * 统一响应结果工具类
 */
class Result {
  constructor(code, message, data) {
    this.code = code;
    this.message = message;
    this.data = data;
    this.timestamp = Date.now();
  }

  /**
   * 成功响应
   */
  static success(data, message = 'success') {
    return new Result(200, message, data);
  }

  /**
   * 失败响应
   */
  static error(message, code = 500) {
    return new Result(code, message, null);
  }
}

/**
 * 响应中间件 - 为 res 添加 success 和 error 方法
 */
function resultMiddleware(req, res, next) {
  res.success = (data, message = 'success') => {
    res.json(Result.success(data, message));
  };

  res.error = (message, code = 500) => {
    res.json(Result.error(message, code));
  };

  next();
}

module.exports = { Result, resultMiddleware };
