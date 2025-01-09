export const stripeRawBody = (handler) => (req, res, next) => {
    if (req.originalUrl.startsWith("/webhook")) {
      req.rawBody = req.body;
    }
    handler(req, res, next);
  };
  