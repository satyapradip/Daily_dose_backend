const winston = require("winston");
const { env } = require("../config/env");

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
    return `[${ts}] ${level}: ${stack || message}${metaStr}`;
  }),
);

const prodFormat = combine(timestamp(), errors({ stack: true }), json());

const logger = winston.createLogger({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  format: env.NODE_ENV === "production" ? prodFormat : devFormat,
  transports: [
    new winston.transports.Console(),
    ...(env.NODE_ENV === "production"
      ? [
          new winston.transports.File({
            filename: "logs/error.log",
            level: "error",
          }),
          new winston.transports.File({ filename: "logs/combined.log" }),
        ]
      : []),
  ],
  exceptionHandlers: [
    new winston.transports.Console(),
    ...(env.NODE_ENV === "production"
      ? [new winston.transports.File({ filename: "logs/exceptions.log" })]
      : []),
  ],
  rejectionHandlers: [
    new winston.transports.Console(),
    ...(env.NODE_ENV === "production"
      ? [new winston.transports.File({ filename: "logs/rejections.log" })]
      : []),
  ],
});

module.exports = { logger };
