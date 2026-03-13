class Result {
  constructor(code, message, data) {
    this.code = code;
    this.message = message;
    this.data = data;
    this.timestamp = Date.now();
  }

  static success(data, message = 'success') {
    return new Result(200, message, data);
  }

  static error(message, code = 500) {
    return new Result(code, message, null);
  }
}

function resultMiddleware(req, res, next) {
  res.success = (data, message = 'success') => {
    res.json(Result.success(data, message));
  };

  res.error = (message, code = 500) => {
    res.json(Result.error(message, code));
  };

  next();
}

export { Result, resultMiddleware };