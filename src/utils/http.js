function httpError(status, message, code) {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}

function asyncHandler(handler) {
  return function wrapped(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function isValidDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function toPositiveInt(value, fieldName = 'ID') {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw httpError(400, `${fieldName} must be a positive integer.`);
  }
  return number;
}

module.exports = { httpError, asyncHandler, isValidDateOnly, toPositiveInt };
