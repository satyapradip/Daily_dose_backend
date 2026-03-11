function validate(schema, target = "body") {
  return (req, res, next) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
        received: e.code,
      }));

      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed.",
          statusCode: 400,
          details: errors,
        },
      });
      return;
    }

    req[target] = result.data;
    next();
  };
}

module.exports = { validate };
